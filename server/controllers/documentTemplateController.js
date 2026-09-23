const documentTemplateService = require('../services/documentTemplateService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class DocumentTemplateController {
  async getTemplates(req, res, next) {
    try {
      const { status, case_type, document_type_id } = req.query;
      const templates = await documentTemplateService.getTemplates({
        status: status || null,
        caseType: case_type || null,
        documentTypeId: document_type_id || null
      });
      return successResponse(res, 'Templates retrieved successfully.', templates);
    } catch (err) {
      next(err);
    }
  }

  async getTemplateById(req, res, next) {
    try {
      const templateId = parseInt(req.params.id, 10);
      const template = await documentTemplateService.getTemplateById(templateId);
      return successResponse(res, 'Template details retrieved successfully.', template);
    } catch (err) {
      next(err);
    }
  }

  async createTemplate(req, res, next) {
    try {
      const { template_code, name, description, document_type_id, case_type, content, variables } = req.body;
      const result = await documentTemplateService.createTemplate({
        templateCode: template_code,
        name,
        description,
        documentTypeId: document_type_id,
        caseType: case_type,
        content,
        variables
      }, req.user.id);
      return successResponse(res, 'Template created successfully.', result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id, 10);
      const { name, description, document_type_id, case_type, content, variables, status } = req.body;
      const result = await documentTemplateService.updateTemplate(templateId, {
        name,
        description,
        documentTypeId: document_type_id,
        caseType: case_type,
        content,
        variables,
        status
      }, req.user.id);
      return successResponse(res, 'Template updated successfully.', result);
    } catch (err) {
      next(err);
    }
  }

  async archiveTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id, 10);
      const result = await documentTemplateService.archiveTemplate(templateId);
      return successResponse(res, 'Template archived successfully.', result);
    } catch (err) {
      next(err);
    }
  }

  async previewTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id, 10);
      const { case_id, client_id, custom_variables } = req.body;

      const template = await documentTemplateService.getTemplateById(templateId);
      const contextVars = await documentTemplateService.getContextVariables(case_id, client_id, req.user.id);
      const combinedVars = { ...contextVars, ...(custom_variables || {}) };

      const { resolvedContent, missingVariables } = documentTemplateService.resolveVariables(template.content, combinedVars);

      return successResponse(res, 'Template preview generated.', {
        templateId,
        resolvedContent,
        missingVariables,
        variablesUsed: combinedVars
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentTemplateController();
