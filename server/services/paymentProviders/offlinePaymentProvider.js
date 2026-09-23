const BasePaymentProvider = require("./basePaymentProvider");

class OfflinePaymentProvider extends BasePaymentProvider {
  constructor() {
    super("OFFLINE");
  }

  getInitialStatus(paymentMethod) {
    if (paymentMethod === "CHEQUE") {
      return "PENDING_CLEARANCE";
    }
    return "SUCCESS"; // In-person cash or hand-verified bank transfer received by authorized advocate/staff
  }
}

module.exports = OfflinePaymentProvider;
