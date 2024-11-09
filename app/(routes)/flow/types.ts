export interface TemplateVariables {
	persona?: string;
	style?: string;
	context?: string;
	[key: string]: string | undefined;
}

export interface ApiTemplateVariables {
	[key: string]: string;
}

export interface ConversationConfig {
	template_id: string;
	template_variables: ApiTemplateVariables;
}
