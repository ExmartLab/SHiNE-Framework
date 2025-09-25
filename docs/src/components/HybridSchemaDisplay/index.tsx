import React, { useState, useEffect } from 'react';
import CodeBlock from '@theme/CodeBlock';
import InlineSchemaDisplay from '@site/src/components/InlineSchemaDisplay';
import generateResolverOptions from '@site/src/components/shared-lib/generateResolverOptions';

interface HybridSchemaDisplayProps {
  schema: object;
  title?: string;
  language?: string;
  resolverOptions?: any;
  showTitle?: boolean;
  timeout?: number;
  basePath?: string;
}

/**
 * Hybrid Schema Display Component
 *
 * Provides different rendering modes:
 * - Static Mode (SSG/LLMS.txt): Shows pre-resolved schemas from build-time processing
 * - Interactive Mode (Browser): Uses existing InlineSchemaDisplay with dynamic resolution
 *
 * This ensures JSON schemas appear properly in LLMS.txt while maintaining
 * interactive functionality for web users.
 */
export default function HybridSchemaDisplay({
  schema,
  title = "JSON Schema",
  language = "json",
  resolverOptions,
  showTitle = true,
  timeout = 15000,
  basePath
}: HybridSchemaDisplayProps) {
  const [resolvedSchema, setResolvedSchema] = useState<any>(null);
  const [isSSG, setIsSSG] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Detect if we're in browser environment
    setIsSSG(typeof window === 'undefined');

    // Try to load pre-resolved schema for SSG/LLMS.txt
    async function loadResolvedSchema() {
      if (typeof window === 'undefined') {
        // Server-side: try to load pre-resolved schema
        try {
          // Generate schema file path based on the original schema name/path
          const schemaKey = getSchemaKey(schema);
          if (schemaKey) {
            // In build context, try to load resolved schema from static files
            const resolvedPath = `/resolved-schemas/${schemaKey}`;

            // This would need to be handled by the build process
            // For now, we'll fall back to the original schema for SSG
            setResolvedSchema(schema);
          } else {
            setResolvedSchema(schema);
          }
        } catch (err) {
          console.warn('Failed to load resolved schema, using original:', err);
          setResolvedSchema(schema);
        }
      }
    }

    loadResolvedSchema();
  }, [schema]);

  // Helper function to generate a key for the schema (for resolved schema lookup)
  function getSchemaKey(schemaObj: any): string | null {
    // Try to extract schema identifier from various possible locations
    if (schemaObj.title) {
      return `${schemaObj.title.toLowerCase().replace(/\s+/g, '-')}.json`;
    }
    if (schemaObj.$id) {
      return schemaObj.$id.split('/').pop() || null;
    }
    if (schemaObj.id) {
      return schemaObj.id.split('/').pop() || null;
    }

    // If we have basePath info, try to construct the path
    if (basePath) {
      return `${basePath}/schema.json`;
    }

    return null;
  }

  // Server-side rendering (SSG) or build-time rendering for LLMS.txt
  if (typeof window === 'undefined') {
    return (
      <div>
        {showTitle && <h3>{title}</h3>}
        <CodeBlock language={language}>
          {JSON.stringify(resolvedSchema || schema, null, 2)}
        </CodeBlock>
      </div>
    );
  }

  // Client-side rendering: use the existing interactive component
  return (
    <InlineSchemaDisplay
      schema={schema}
      title={title}
      language={language}
      resolverOptions={resolverOptions}
      showTitle={showTitle}
      timeout={timeout}
    />
  );
}

/**
 * Server-side schema resolution utility for build-time processing
 * This function is used during the build process to resolve schemas statically
 */
export async function resolveSchemaStatically(schema: any, basePath: string = ''): Promise<any> {
  // This would be called during the build process by our schema resolver
  // For now, it's a placeholder that returns the original schema

  // In a full implementation, this would:
  // 1. Check if a pre-resolved version exists in /static/resolved-schemas/
  // 2. Load and return the resolved schema
  // 3. Fall back to the original schema if resolution failed

  return schema;
}

/**
 * Convenience wrapper for common device schema usage
 */
export function DeviceSchemaDisplay({ schema, basePath = "/schemas/device", ...props }: Omit<HybridSchemaDisplayProps, 'resolverOptions'>) {
  const resolverOptions = generateResolverOptions({ basePath });

  return (
    <HybridSchemaDisplay
      schema={schema}
      resolverOptions={resolverOptions}
      basePath={basePath}
      {...props}
    />
  );
}

/**
 * Convenience wrapper for general schema usage with custom base path
 */
export function SchemaDisplayWithPath({ basePath, schema, ...props }: HybridSchemaDisplayProps & { basePath: string }) {
  const resolverOptions = generateResolverOptions({ basePath });

  return (
    <HybridSchemaDisplay
      schema={schema}
      resolverOptions={resolverOptions}
      basePath={basePath}
      {...props}
    />
  );
}