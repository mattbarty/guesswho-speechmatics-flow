import { TemplateVariables, ApiTemplateVariables } from './types';

export function sanitizeTemplateVariables(
	variables: TemplateVariables
): ApiTemplateVariables {
	// Filter out undefined values and ensure all values are strings
	return Object.entries(variables).reduce((acc, [key, value]) => {
		if (value !== undefined && value !== '') {
			acc[key] = value;
		}
		return acc;
	}, {} as ApiTemplateVariables);
}
