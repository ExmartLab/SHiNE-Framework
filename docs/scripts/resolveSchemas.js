const fs = require('fs');
const path = require('path');

/**
 * Server-side JSON Schema resolver for build-time processing
 * Resolves all $ref references and generates static schemas for LLMS.txt
 */
class ServerSideSchemaResolver {
  constructor(schemaBasePath) {
    this.schemaBasePath = schemaBasePath;
    this.schemaCache = new Map();
    this.resolvedSchemas = new Map();
  }

  /**
   * Load a JSON schema from the file system
   */
  loadSchema(relativePath) {
    if (this.schemaCache.has(relativePath)) {
      return this.schemaCache.get(relativePath);
    }

    const fullPath = path.resolve(this.schemaBasePath, relativePath);

    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Schema file not found: ${fullPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const schema = JSON.parse(content);
      this.schemaCache.set(relativePath, schema);
      return schema;
    } catch (error) {
      console.error(`❌ Error loading schema ${relativePath}:`, error.message);
      return null;
    }
  }

  /**
   * Resolve a single $ref reference
   */
  resolveReference(ref, currentDirectory = '') {
    let fullRef = ref;

    // Handle relative references
    if (!ref.startsWith('/') && !ref.startsWith('http') && currentDirectory) {
      fullRef = path.posix.join(currentDirectory, ref);
    }

    // Remove leading slash if present
    fullRef = fullRef.startsWith('/') ? fullRef.substring(1) : fullRef;

    return this.loadSchema(fullRef);
  }

  /**
   * Get directory context from a file path
   */
  getDirectoryFromPath(filePath) {
    if (!filePath.includes('/')) return '';
    return path.posix.dirname(filePath);
  }

  /**
   * Recursively resolve all $ref references in a schema
   */
  resolveRefs(obj, visited = new Set(), currentDirectory = '') {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle $ref
    if (obj.$ref) {
      const refUrl = obj.$ref;
      const contextualRef = `${currentDirectory}:${refUrl}`;

      // Prevent circular references
      if (visited.has(contextualRef)) {
        console.warn(`⚠️  Circular reference detected: ${contextualRef}`);
        return {
          $ref: refUrl,
          error: `Circular reference detected: ${refUrl}`
        };
      }

      visited.add(contextualRef);

      try {
        const referencedSchema = this.resolveReference(refUrl, currentDirectory);
        if (referencedSchema) {
          // Determine new directory context for nested resolution
          let newDirectory = currentDirectory;
          if (refUrl.includes('/')) {
            const refDirectory = this.getDirectoryFromPath(refUrl);
            newDirectory = currentDirectory
              ? path.posix.join(currentDirectory, refDirectory)
              : refDirectory;
          }

          // Recursively resolve the referenced schema
          const resolved = this.resolveRefs(referencedSchema, new Set(visited), newDirectory);
          visited.delete(contextualRef);
          return resolved;
        } else {
          visited.delete(contextualRef);
          return {
            $ref: refUrl,
            error: `Failed to resolve reference: ${refUrl}`
          };
        }
      } catch (error) {
        console.warn(`⚠️  Failed to resolve $ref ${refUrl}:`, error.message);
        visited.delete(contextualRef);
        return {
          $ref: refUrl,
          error: error.message
        };
      }
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveRefs(item, visited, currentDirectory));
    }

    // Handle objects
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = this.resolveRefs(value, visited, currentDirectory);
    }
    return resolved;
  }

  /**
   * Resolve a schema and all its references
   */
  dereference(schema, initialDirectory = '') {
    const resolved = this.resolveRefs(schema, new Set(), initialDirectory);
    return resolved;
  }

  /**
   * Process all schemas in a directory and generate resolved versions
   */
  processAllSchemas(outputDirectory) {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const processDirectory = (dir) => {
      const fullPath = path.resolve(this.schemaBasePath, dir);
      if (!fs.existsSync(fullPath)) return;

      const items = fs.readdirSync(fullPath);

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const relativePath = path.posix.join(dir, item);

        if (fs.statSync(itemPath).isDirectory()) {
          // Recursively process subdirectories
          processDirectory(relativePath);
        } else if (item.endsWith('.json')) {
          // Process JSON schema files

          const schema = this.loadSchema(relativePath);
          if (schema) {
            try {
              const resolved = this.dereference(schema, dir);

              // Create output file path
              const outputPath = path.join(outputDirectory, relativePath);
              const outputDir = path.dirname(outputPath);

              // Create subdirectories if needed
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
              }

              // Write resolved schema
              fs.writeFileSync(outputPath, JSON.stringify(resolved, null, 2));

            } catch (error) {
              console.error(`❌ Error processing ${relativePath}:`, error.message);
            }
          }
        }
      }
    };

    processDirectory('');
  }
}

// Main execution
if (require.main === module) {
  const schemaBasePath = path.resolve(__dirname, '../static/schemas');
  const outputDirectory = path.resolve(__dirname, '../static/resolved-schemas');

  const resolver = new ServerSideSchemaResolver(schemaBasePath);
  resolver.processAllSchemas(outputDirectory);
}

module.exports = ServerSideSchemaResolver;