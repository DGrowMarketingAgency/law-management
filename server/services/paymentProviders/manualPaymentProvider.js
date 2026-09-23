const BasePaymentProvider = require("./basePaymentProvider");

class ManualPaymentProvider extends BasePaymentProvider {
  constructor() {
    super("MANUAL");
  }

  /**
   * Determine initial status based on payment method
   * Cheques begin in PENDING_CLEARANCE; other manual methods begin in PENDING_VERIFICATION.
   */
  getInitialStatus(paymentMethod) {
    if (paymentMethod === "CHEQUE") {
      return "PENDING_CLEARANCE";
    }
    return "PENDING_VERIFICATION";
  }

  /**
   * Validate required manual payment details
   */
  validateDetails(paymentMethod, details = {}) {
    const errors = [];
    if (paymentMethod === "BANK_TRANSFER") {
      if (!details.reference_number) {
        errors.push("Bank UTR / Transaction Reference Number is required for Bank Transfers.");
      }
    } else if (paymentMethod === "UPI" || paymentMethod === "UPI_MANUAL") {
      if (!details.reference_number && !details.transaction_id) {
        errors.push("UPI Reference / Transaction ID is required for UPI payments.");
      }
    } else if (paymentMethod === "CHEQUE") {
      if (!details.reference_number) {
        errors.push("Cheque Number is required for Cheque payments.");
      }
    }
    return errors;
  }
}

module.exports = ManualPaymentProvider;
