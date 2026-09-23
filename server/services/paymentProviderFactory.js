const RazorpayPaymentProvider = require("./paymentProviders/razorpayPaymentProvider");
const PayUPaymentProvider = require("./paymentProviders/payuPaymentProvider");
const ManualPaymentProvider = require("./paymentProviders/manualPaymentProvider");
const OfflinePaymentProvider = require("./paymentProviders/offlinePaymentProvider");

class PaymentProviderFactory {
  constructor() {
    this.providers = {
      RAZORPAY: new RazorpayPaymentProvider(),
      PAYU: new PayUPaymentProvider(),
      MANUAL: new ManualPaymentProvider(),
      OFFLINE: new OfflinePaymentProvider(),
    };
  }

  /**
   * Retrieve a payment provider instance by key
   * @param {'RAZORPAY'|'PAYU'|'MANUAL'|'OFFLINE'} providerName
   * @returns {import('./paymentProviders/basePaymentProvider')}
   */
  getProvider(providerName) {
    const key = (providerName || "").toUpperCase().trim();
    const provider = this.providers[key];
    if (!provider) {
      const err = new Error(`Unsupported payment provider: '${providerName}'. Supported: ${Object.keys(this.providers).join(", ")}`);
      err.code = "UNSUPPORTED_PROVIDER";
      err.statusCode = 422;
      throw err;
    }
    return provider;
  }

  getSupportedProviders() {
    return Object.keys(this.providers);
  }
}

const factoryInstance = new PaymentProviderFactory();

module.exports = {
  paymentProviderFactory: factoryInstance,
  getPaymentProvider: (name) => factoryInstance.getProvider(name),
};
