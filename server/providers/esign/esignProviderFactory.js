const DigioProvider = require('./DigioProvider');
const LeegalityProvider = require('./LeegalityProvider');
const MockESignProvider = require('./MockESignProvider');

class ESignProviderFactory {
  constructor() {
    this.providers = {
      DIGIO: new DigioProvider(),
      LEEGALITY: new LeegalityProvider(),
      MOCK: new MockESignProvider()
    };
  }

  /**
   * Get eSign provider instance by name
   * @param {string} providerName - 'DIGIO' | 'LEEGALITY' | 'MOCK'
   * @returns {ESignProvider}
   */
  getProvider(providerName) {
    const defaultProvider = process.env.NODE_ENV === 'production' ? 'DIGIO' : 'MOCK';
    const requested = (providerName || process.env.ESIGN_PROVIDER || defaultProvider).toUpperCase();
    
    if (requested === 'MOCK' && process.env.NODE_ENV === 'production') {
      const err = new Error('Mock e-sign provider is strictly disabled in production mode. Configure DIGIO or LEEGALITY credentials.');
      err.code = 'ESIGN_MOCK_DISABLED_IN_PRODUCTION';
      err.statusCode = 400;
      throw err;
    }

    if (this.providers[requested]) {
      return this.providers[requested];
    }

    const err = new Error(`Unsupported or unconfigured eSign provider: ${requested}. Please configure DIGIO or LEEGALITY.`);
    err.code = 'ESIGN_PROVIDER_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
}

const factory = new ESignProviderFactory();
module.exports = factory;
module.exports.getESignProvider = (name) => factory.getProvider(name);
