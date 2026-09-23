const validateRecordPayment = (body) => {
  const errors = [];

  if (!body.invoice_id || isNaN(parseInt(body.invoice_id, 10))) {
    errors.push("invoice_id must be a valid integer ID.");
  }

  if (body.amount === undefined || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    errors.push("amount must be a positive number.");
  }

  if (!body.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date)) {
    errors.push("payment_date must be in YYYY-MM-DD format.");
  }

  if (body.payment_method) {
    const allowed = [
      "CASH",
      "BANK_TRANSFER",
      "UPI",
      "CARD",
      "CHEQUE",
      "RETAINER_DRAW",
      "ONLINE_GATEWAY",
      "OTHER",
    ];
    if (!allowed.includes(body.payment_method)) {
      errors.push(`payment_method must be one of: ${allowed.join(", ")}`);
    }
  }

  return errors;
};

module.exports = {
  validateRecordPayment,
};
