const retainerService = require('../services/retainerService');
const { validateRetainer, validateRetainerDeposit, validateRetainerRefund } = require('../validators/retainerValidator');

/**
 * Create a new retainer account for a client
 */
const createRetainer = async (req, res, next) => {
    try {
        const { error, value } = validateRetainer(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const retainer = await retainerService.createRetainer(value, req.user.id);
        res.status(201).json({
            success: true,
            message: 'Retainer account created successfully',
            data: retainer
        });
    } catch (err) {
        next(err);
    }
};

/**
 * List retainer accounts
 */
const listRetainers = async (req, res, next) => {
    try {
        const retainers = await retainerService.listRetainers(req.query);
        res.json({
            success: true,
            data: retainers
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get retainer account details with ledger
 */
const getRetainer = async (req, res, next) => {
    try {
        const retainer = await retainerService.getRetainerById(req.params.id);
        if (!retainer) {
            return res.status(404).json({ success: false, message: 'Retainer account not found' });
        }
        res.json({
            success: true,
            data: retainer
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Deposit funds into a retainer account
 */
const depositFunds = async (req, res, next) => {
    try {
        const { error, value } = validateRetainerDeposit(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const result = await retainerService.depositFunds(req.params.id, value, req.user.id);
        res.json({
            success: true,
            message: 'Retainer funds deposited successfully',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Refund remaining retainer funds to client
 */
const refundFunds = async (req, res, next) => {
    try {
        const { error, value } = validateRetainerRefund(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const result = await retainerService.refundFunds(req.params.id, value, req.user.id);
        res.json({
            success: true,
            message: 'Retainer funds refunded successfully',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createRetainer,
    listRetainers,
    getRetainer,
    depositFunds,
    refundFunds
};
