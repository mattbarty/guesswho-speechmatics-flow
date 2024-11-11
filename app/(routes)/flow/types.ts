export interface TemplateVariables {
	persona: string;
	style: string;
	context: string;
}

export interface Character {
	name: string;
	description: string;
	styleGuide: string;
	eraLimit: string;
	keyTraits: string[];
}

export interface Characters {
	[key: string]: Character;
}

export interface ApiTemplateVariables {
	[key: string]: string;
}

export interface ConversationConfig {
	template_id: string;
	template_variables: ApiTemplateVariables;
}
