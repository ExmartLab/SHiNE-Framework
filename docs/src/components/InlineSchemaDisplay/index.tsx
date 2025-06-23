import React, { useState, useEffect } from 'react';
import CodeBlock from '@theme/CodeBlock';
import generateResolverOptions from '@site/src/components/shared-lib/generateResolverOptions';

/**
 * Enhanced JSON Schema resolver that handles nested references with proper path context
 */
class SchemaRefResolver {
  private resolvers: any;
  private schemaCache = new Map<string, any>();

  constructor(resolverOptions: any = {}) {
    this.resolvers = resolverOptions.resolvers || {};
  }

  private async resolveReference(ref: string, currentDirectory: string = ''): Promise<any> {
    // Construct the full reference path
    let fullRef = ref;
    
    // If it's a relative reference and we have a current directory context
    if (!ref.startsWith('/') && !ref.startsWith('http') && currentDirectory) {
      fullRef = `${currentDirectory}/${ref}`;
    }
    
    // Check cache first
    if (this.schemaCache.has(fullRef)) {
      return this.schemaCache.get(fullRef);
    }

    try {

      const fileResolver = this.resolvers.file;
      if (fileResolver && fileResolver.resolve) {
        const resolvedSchema = await fileResolver.resolve(fullRef);
        this.schemaCache.set(fullRef, resolvedSchema);
        return resolvedSchema;
      } else {
        throw new Error(`No file resolver available for: ${fullRef}`);
      }
    } catch (error) {
      console.error(`❌ Failed to resolve reference ${fullRef}:`, error);
      throw error;
    }
  }

  private getDirectoryFromPath(path: string): string {
    if (!path.includes('/')) return '';
    return path.substring(0, path.lastIndexOf('/'));
  }

  async dereference(schema: any): Promise<any> {
    return this.resolveRefs(schema, new Set(), '');
  }

  async resolveRefs(obj: any, visited = new Set<string>(), currentDirectory: string = ''): Promise<any> {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle $ref
    if (obj.$ref) {
      const refUrl = obj.$ref;
      
      // Create a unique key for this reference in this context
      const contextualRef = `${currentDirectory}:${refUrl}`;
      
      // Prevent circular references
      if (visited.has(contextualRef)) {
        console.warn(`Circular reference detected: ${contextualRef}`);
        return { 
          error: `Circular reference detected: ${refUrl}` 
        };
      }

      visited.add(contextualRef);
      
      try {
        const referencedSchema = await this.resolveReference(refUrl, currentDirectory);
        if (referencedSchema) {
          // Determine the new directory context for nested resolution
          let newDirectory = currentDirectory;
          
          // If the reference contains a path, update the directory context
          if (refUrl.includes('/')) {
            const refDirectory = this.getDirectoryFromPath(refUrl);
            newDirectory = currentDirectory ? `${currentDirectory}/${refDirectory}` : refDirectory;
          }
          
          // Recursively resolve the referenced schema with the new directory context
          const resolved = await this.resolveRefs(referencedSchema, new Set(visited), newDirectory);
          visited.delete(contextualRef);
          return resolved;
        }
      } catch (error) {
        console.warn(`Failed to resolve $ref ${refUrl}:`, error);
        visited.delete(contextualRef);
        return { 
          $ref: refUrl,
          error: error.message 
        };
      }
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      const resolved = [];
      for (const item of obj) {
        resolved.push(await this.resolveRefs(item, visited, currentDirectory));
      }
      return resolved;
    }

    // Handle objects
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = await this.resolveRefs(value, visited, currentDirectory);
    }
    return resolved;
  }
}

interface InlineSchemaDisplayProps {
  schema: object;
  title?: string;
  language?: string;
  resolverOptions?: any;
  showTitle?: boolean;
  timeout?: number;
}

export default function InlineSchemaDisplay({ 
  schema, 
  title = "JSON Schema", 
  language = "json",
  resolverOptions,
  showTitle = true,
  timeout = 15000
}: InlineSchemaDisplayProps) {
  const [resolvedSchema, setResolvedSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveSchema() {
      try {
        setLoading(true);
        setError(null);

        if (!resolverOptions) {
          setResolvedSchema(schema);
          return;
        }

        const resolver = new SchemaRefResolver(resolverOptions);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Schema resolution timeout')), timeout);
        });

        const resolutionPromise = resolver.dereference(schema);
        
        const resolved = await Promise.race([resolutionPromise, timeoutPromise]);
        setResolvedSchema(resolved);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error resolving schema references:', err);
        setResolvedSchema(schema);
      } finally {
        setLoading(false);
      }
    }

    if (schema) {
      resolveSchema();
    }
  }, [schema, resolverOptions, timeout]);

  if (loading) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: 'var(--ifm-color-secondary-lightest)',
        borderRadius: '4px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid var(--ifm-color-primary-light)',
          borderTop: '2px solid var(--ifm-color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        Resolving schema references...
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  const errorMessage = error && (
    <div style={{ 
      padding: '0.75rem', 
      backgroundColor: 'var(--ifm-color-warning-light)',
      borderRadius: '4px',
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      border: '1px solid var(--ifm-color-warning-dark)'
    }}>
      ⚠️ <strong>Resolution Warning:</strong> {error}
      <br />
      <small>Showing schema with potentially unresolved references.</small>
    </div>
  );

  return (
    <div>
      {showTitle && <h3>{title}</h3>}
      {errorMessage}
      <CodeBlock language={language}>
        {JSON.stringify(resolvedSchema, null, 2)}
      </CodeBlock>
    </div>
  );
}