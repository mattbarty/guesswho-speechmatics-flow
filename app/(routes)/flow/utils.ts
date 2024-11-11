import { TemplateVariables, ApiTemplateVariables } from './types';
import { characters } from './characterData';

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

export function getRandomCharacter() {
	const characterIds = Object.keys(characters);
	const randomId =
		characterIds[Math.floor(Math.random() * characterIds.length)];
	const character = characters[randomId as keyof typeof characters];

	// Format the character data for the template
	const formattedDescription = `
${character.description}

Additional Context:
- Time Period: ${character.eraLimit}
- Key Traits: ${character.keyTraits.join(', ')}
`;

	return {
		persona: formattedDescription,
		style: character.styleGuide,
		characterName: character.name,
	};
}
