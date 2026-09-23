const validateCreateRetainer = (body) => {
  const errors = [];

  if (!body.client_id || isNaN(parseInt(body.client_id, 10))) {
    errors.push("client_id must be a valid integer ID.");
  }

  if (!body.name || !String(body.name).trim()) {
    errors.push("Retainer account name is required.");
  }

  if (!body.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
    errors.push("start_date must be in YYYY-MM-DD format.");
  }

  if (body.opening_amount !== undefined && (isNaN(Number(body.opening_amount)) || Number(body.opening_amount) < 0)) {
    errors.push("opening_amount must be a non-negative number.");
  }

  return errors;
};

const validateRetainerTransaction = (body) => {
  const errors = [];

  if (body.amount === undefined || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    errors.push("amount must be a positive number.");
  }

  if (body.transaction_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date)) {
    errors.push("transaction_date must be in YYYY-MM-DD format.");
  }

  return errors;
};

module.exports = {
  validateCreateRetainer,
  validateRetainerTransaction,
};
