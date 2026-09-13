import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

type FrankfurterRate = {
	date: string;
	base: string;
	quote: string;
	rate: number;
};

function normalizeDate(value: unknown): string {
	const trimmedValue = typeof value === 'string' ? value.trim() : '';
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmedValue);

	if (match) {
		return `${match[3]}-${match[2]}-${match[1]}`;
	}

	return trimmedValue;
}

export class CurrencyExchange implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Currency Exchange',
		name: 'currencyExchange',
		icon: {
			light: 'file:CurrencyExchange.svg',
			dark: 'file:CurrencyExchange.dark.svg',
		},
		group: ['transform'],
		version: 1,
		description: 'Convert a price to one or more currencies',
		subtitle: '={{ $parameter["amount"] + " " + $parameter["from"] }}',
		defaults: {
			name: 'Currency Exchange',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Source Currency Code',
				name: 'from',
				type: 'string',
				typeOptions: {
					ai: true,
				},
				default: 'EUR',
				required: true,
				description:
					'Enter the three-letter ISO 4217 code of the currency to convert from, for example EUR, USD, GBP or JPY.',
			},
			{
				displayName: 'Price',
				name: 'amount',
				type: 'number',
				default: 1,
				required: true,
				description: 'Price to convert',
			},
			{
				displayName: 'Target Currencies',
				name: 'targets',
				type: 'string',
				placeholder: 'USD, JPY, CHF',
				typeOptions: {
					ai: true,
				},
				default: '',
				required: true,
				description:
					'Enter one or more target currency codes separated by commas. Examples: USD (US dollar), JPY (Japanese yen), CHF (Swiss franc), GBP (British pound), CAD (Canadian dollar).',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'string',
				default: '',
				placeholder: 'DD/MM/YYYY or YYYY-MM-DD',
				typeOptions: {
					ai: true,
				},
				description:
					'Optional start of the exchange-rate period. Leave empty to use today. Enter DD/MM/YYYY or YYYY-MM-DD.',
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'string',
				default: '',
				placeholder: 'DD/MM/YYYY or YYYY-MM-DD',
				typeOptions: {
					ai: true,
				},
				description:
					'Optional end of the exchange-rate period. Leave empty to retrieve the rate for the start date only. Enter DD/MM/YYYY or YYYY-MM-DD.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const currencyCodePattern = /^[A-Z]{3}$/;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const from = (this.getNodeParameter('from', itemIndex) as string)
					.trim()
					.toUpperCase();
				const amount = this.getNodeParameter('amount', itemIndex) as number;
				const requestedStartDate = normalizeDate(
					this.getNodeParameter('startDate', itemIndex, ''),
				);
				const requestedEndDate = normalizeDate(
					this.getNodeParameter('endDate', itemIndex, ''),
				);
				const today = new Date().toISOString().slice(0, 10);
				const startDate = requestedStartDate || today;
				const endDate = requestedEndDate || startDate;
				const targetCodes = (this.getNodeParameter('targets', itemIndex) as string).trim();
				const targetCurrencies = [
					...new Set(
						targetCodes
							.split(',')
							.map((currency) => currency.trim().toUpperCase())
							.filter(Boolean),
					),
				];

				if (!currencyCodePattern.test(from)) {
					throw new NodeOperationError(
						this.getNode(),
						'Enter a valid three-letter source currency code.',
						{ itemIndex },
					);
				}

				if (!Number.isFinite(amount) || amount < 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Price must be a positive number or zero.',
						{ itemIndex },
					);
				}

				if (targetCurrencies.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Enter at least one target currency code.',
						{ itemIndex },
					);
				}

				if (targetCurrencies.some((currency) => !currencyCodePattern.test(currency))) {
					throw new NodeOperationError(
						this.getNode(),
						'Every target currency must use a three-letter ISO code.',
						{ itemIndex },
					);
				}

				const datePattern = /^\d{4}-\d{2}-\d{2}$/;
				if (!datePattern.test(startDate) || (endDate && !datePattern.test(endDate))) {
					throw new NodeOperationError(
						this.getNode(),
						'Start and end dates must use DD/MM/YYYY or YYYY-MM-DD format.',
						{ itemIndex },
					);
				}

				const startTimestamp = Date.parse(`${startDate}T00:00:00Z`);
				const endTimestamp = Date.parse(`${endDate}T00:00:00Z`);
				if (
					Number.isNaN(startTimestamp) ||
					Number.isNaN(endTimestamp) ||
					startDate > endDate
				) {
					throw new NodeOperationError(
						this.getNode(),
						'Enter a valid date range where the start date is before or equal to the end date.',
						{ itemIndex },
					);
				}

				const rates = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://api.frankfurter.dev/v2/rates',
					qs: {
						base: from,
						quotes: targetCurrencies.join(','),
						...(requestedEndDate
							? { from: startDate, to: endDate }
							: { date: startDate }),
					},
					json: true,
				})) as FrankfurterRate[];

				if (!Array.isArray(rates)) {
					throw new NodeOperationError(
						this.getNode(),
						'Frankfurter returned an unexpected response.',
						{ itemIndex },
					);
				}

				for (const rate of rates) {
					returnData.push({
						json: {
							...items[itemIndex].json,
							date: rate.date,
							from: rate.base,
							to: rate.quote,
							rate: rate.rate,
							amount,
							convertedAmount: Math.round(amount * rate.rate * 100) / 100,
						},
						pairedItem: { item: itemIndex },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							...items[itemIndex].json,
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: itemIndex },
					});
				} else {
					throw new NodeOperationError(
						this.getNode(),
						error instanceof Error ? error.message : String(error),
						{ itemIndex },
					);
				}
			}
		}

		return [returnData];
	}
}