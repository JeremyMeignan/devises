import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
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

type FrankfurterCurrency = {
	iso_code: string;
	name: string;
};

type TargetCurrencyCollection = {
	target?: Array<{
		currency?: string;
	}>;
};

export class Frankfurter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Frankfurter',
		name: 'frankfurter',
		icon: { light: 'file:frankfurter.svg', dark: 'file:frankfurter.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Convert a price to one or more currencies',
		subtitle: '={{ $parameter["amount"] + " " + $parameter["from"] }}',
		defaults: {
			name: 'Frankfurter',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Source Currency Name or ID',
				name: 'from',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getCurrencies',
				},
				default: 'EUR',
				required: true,
				description: 'Currency of the price to convert. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
				type: 'fixedCollection',
				placeholder: 'Add Target Currency',
				typeOptions: {
					multipleValues: true,
				},
				default: {
					target: [{ currency: 'USD' }],
				},
				options: [
					{
						displayName: 'Target Currency',
						name: 'target',
						values: [
							{
								displayName: 'Currency Name or ID',
								name: 'currency',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getCurrencies',
								},
								default: 'USD',
								required: true,
								description: 'Currency to convert the price into. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
							},
						],
					},
				],
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD',
				description: 'Exchange-rate date; leave empty for the latest available rate',
			},
		],
	};

	methods = {
		loadOptions: {
			async getCurrencies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const currencies = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://api.frankfurter.dev/v2/currencies',
					json: true,
				})) as FrankfurterCurrency[];

				return currencies
					.map((currency) => ({
						name: `${currency.iso_code} — ${currency.name}`,
						value: currency.iso_code,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const currencyCodePattern = /^[A-Z]{3}$/;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const from = (this.getNodeParameter('from', itemIndex) as string).trim().toUpperCase();
				const amount = this.getNodeParameter('amount', itemIndex) as number;
				const date = (this.getNodeParameter('date', itemIndex, '') as string).trim();
				const targets = this.getNodeParameter(
					'targets',
					itemIndex,
					{},
				) as TargetCurrencyCollection;

				const targetCurrencies = [
					...new Set(
						(targets.target ?? [])
							.map(({ currency }) => currency?.trim().toUpperCase() ?? '')
							.filter(Boolean),
					),
				];

				if (!currencyCodePattern.test(from)) {
					throw new NodeOperationError(
						this.getNode(),
						'Select a valid three-letter source currency code.',
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
						'Add at least one target currency.',
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

				const rates = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://api.frankfurter.dev/v2/rates',
					qs: {
						base: from,
						quotes: targetCurrencies.join(','),
						...(date ? { date } : {}),
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

				const ratesByCurrency = new Map(rates.map((rate) => [rate.quote, rate]));

				for (const targetCurrency of targetCurrencies) {
					const rate = ratesByCurrency.get(targetCurrency);

					if (!rate) {
						throw new NodeOperationError(
							this.getNode(),
							`No exchange rate is available for ${from} to ${targetCurrency}.`,
							{ itemIndex },
						);
					}

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