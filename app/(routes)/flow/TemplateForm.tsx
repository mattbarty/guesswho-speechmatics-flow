'use client';

import { useState } from 'react';
import { TemplateVariables } from './types';

interface TemplateFormProps {
  variables: TemplateVariables;
  onChange: (variables: TemplateVariables) => void;
}

export function TemplateForm({ variables, onChange }: TemplateFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof TemplateVariables, value: string) => {
    onChange({
      ...variables,
      [key]: value,
    });
  };

  return (
    <article className="template-form">
      <header>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="secondary outline"
        >
          {isExpanded ? 'Hide Template Variables' : 'Show Template Variables'}
        </button>
      </header>

      {isExpanded && (
        <div className="flex flex-col gap-2">
          <label>
            Persona Description
            <textarea
              value={variables.persona || ''}
              onChange={(e) => handleChange('persona', e.target.value)}
              placeholder="e.g., You are an aging English rock star named Roger Godfrey"
              rows={3}
            />
          </label>

          <label>
            Style Guide
            <textarea
              value={variables.style || ''}
              onChange={(e) => handleChange('style', e.target.value)}
              placeholder="e.g., Be charming but unpredictable..."
              rows={3}
            />
          </label>

          <label>
            Context
            <textarea
              value={variables.context || ''}
              onChange={(e) => handleChange('context', e.target.value)}
              placeholder="e.g., You are taking a customer's order..."
              rows={3}
            />
          </label>

          <button
            type="button"
            className="secondary"
            onClick={() => onChange({})}
          >
            Clear All Variables
          </button>
        </div>
      )}
    </article>
  );
} 