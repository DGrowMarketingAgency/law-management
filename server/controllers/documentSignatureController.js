const documentSignatureService = require('../services/documentSignatureService');
const { getESignProvider } = require('../providers/esign/esignProviderFactory');

// Create e-signature request for a document
exports.createSignatureRequest = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { signers, provider, expiresAt, notes } = req.body;

    const request = await documentSignatureService.createSignatureRequest(
      documentId,
      req.user.id,
      { signers, provider, expiresAt, notes }
    );

    res.status(201).json({
      success: true,
      message: 'Signature request initiated successfully',
      data: request
    });
  } catch (err) {
    next(err);
  }
};

// Get signature request details
exports.getSignatureRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const details = await documentSignatureService.getSignatureRequestDetails(requestId);
    res.status(200).json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
};

// Cancel signature request
exports.cancelSignatureRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const { reason } = req.body;
    const result = await documentSignatureService.cancelSignatureRequest(requestId, req.user.id, reason);
    res.status(200).json({
      success: true,
      message: 'Signature request cancelled successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Download signed document
exports.downloadSignedDocument = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const { buffer, filename, contentType } = await documentSignatureService.downloadSignedDocument(requestId);

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

// Webhook endpoint for eSign providers (Digio, Leegality, Mock)
exports.handleWebhook = async (req, res, next) => {
  try {
    const providerName = req.params.provider;
    const provider = getESignProvider(providerName);
    const signature = req.headers['x-verify-signature'] || req.headers['x-leegality-signature'] || req.headers['authorization'];

    // Verify webhook authenticity
    const isValid = provider.verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const payload = req.body;
    const result = await documentSignatureService.processWebhookEvent(providerName, payload);

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get eSign provider status/config
exports.getProviderStatus = async (req, res, next) => {
  try {
    const providerName = req.query.provider || process.env.ESIGN_PROVIDER || 'mock';
    const provider = getESignProvider(providerName);
    res.status(200).json({
      success: true,
      data: {
        activeProvider: providerName,
        providerName: provider.getName(),
        isConfigured: providerName === 'mock' || !!process.env.ESIGN_CLIENT_ID
      }
    });
  } catch (err) {
    next(err);
  }
};
