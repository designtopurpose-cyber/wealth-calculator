// Single source of truth for region-specific constants.
// Currently only ZA. When adding US:
//   1. Define a US config object below.
//   2. Replace the bottom export with a region-detection function
//      (e.g. branch on req.headers.host or process.env.REGION).
//   3. Wire each consumer to pass region context if it doesn't already.

const ZA = {
  region:        'ZA',
  currency:      'ZAR',
  currencySign:  'R',
  baseUrl:       'https://mywealthlens.com',
  paymentGateway: 'payfast',

  plans: {
    monthly: { amount: '39.00',  frequency: '3', itemName: 'MyWealthLens Pro Monthly' },
    annual:  { amount: '399.00', frequency: '6', itemName: 'MyWealthLens Pro Annual'  },
  },

  payfast: {
    formUrl: 'https://www.payfast.co.za/eng/process',
    apiBase: 'https://api.payfast.co.za',
  },

  emailFrom: 'MyWealthLens <noreply@mywealthlens.com>',
  dateLocale: 'en-ZA',
};

module.exports = ZA;
