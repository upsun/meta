<?php

namespace Upsun;

use Exception;
use InvalidArgumentException;
use RuntimeException;
use stdClass;

/**
 * Preprocessing script to patch OpenAPI schema for SDK generation
 */
class OpenApiPreprocessor
{
    private array $schema;
    private array $routeTypes = ['ProxyRoute', 'RedirectRoute', 'UpstreamRoute'];

    private int $refUpdateCount = 0;

    public function __construct(string $schemaPath)
    {
        if (!file_exists($schemaPath)) {
            throw new InvalidArgumentException("Schema file does not exist: {$schemaPath}");
        }

        $content = file_get_contents($schemaPath);
        $content = $this->replaceHTTPAccessPermission($content);
        $this->schema = json_decode($content, true, 512, JSON_THROW_ON_ERROR);

        $this->fixAllRefsWithAllOf($this->schema);

        if (!$this->schema) {
            throw new InvalidArgumentException("Unable to parse schema JSON");
        }
    }

    /**
     * Collect all properties of all route types
     */
    private function collectAllRouteProperties(): array
    {
        $allProperties = [];

        foreach ($this->routeTypes as $routeType) {
            if (!isset($this->schema['components']['schemas'][$routeType])) {
                echo "⚠️  Schema '{$routeType}' not found, skipped.\n";
                continue;
            }

            $properties = $this->schema['components']['schemas'][$routeType]['properties'] ?? [];

            foreach ($properties as $propName => $propDefinition) {
                if (!isset($allProperties[$propName])) {
                    $allProperties[$propName] = $propDefinition;
                    echo "✓ Found property: {$propName} (from {$routeType})\n";
                }
            }
        }

        return $allProperties;
    }

    /**
     * Make missing properties nullable for each route type
     */
    public function makePropertiesNullable(): void
    {
        echo "🔍 Collecting properties from all route types...\n";
        $allProperties = $this->collectAllRouteProperties();

        echo "\n📝 Processing route schemas...\n";

        foreach ($this->routeTypes as $routeType) {
            if (!isset($this->schema['components']['schemas'][$routeType])) {
                continue;
            }

            $route = &$this->schema['components']['schemas'][$routeType];
            $existingProperties = $route['properties'] ?? [];
            $addedProperties = [];

            foreach ($allProperties as $propName => $propDefinition) {
                if (!isset($existingProperties[$propName])) {
                    // Create a nullable version of the property
                    $nullableProp = $this->createNullableProperty($propDefinition);
                    $route['properties'][$propName] = $nullableProp;
                    $addedProperties[] = $propName;
                } else {
                    // Force 'id' property to be nullable
                    if ($propName === 'id' && !($existingProperties[$propName]['nullable'] ?? false)) {
                        $route['properties'][$propName]['nullable'] = true;
                        $addedProperties[] = $propName . " (forced nullable)";
                    }

                    // Check if this property is nullable in any other route type
                    foreach ($this->routeTypes as $otherRouteType) {
                        if ($otherRouteType === $routeType) {
                            continue;
                        }
                        $otherProperties = $this->schema['components']['schemas'][$otherRouteType]['properties'] ?? [];
                        if (isset($otherProperties[$propName]) && ($otherProperties[$propName]['nullable'] ?? false)) {
                            // Make current property nullable if it's not already
                            if (!($existingProperties[$propName]['nullable'] ?? false)) {
                                $route['properties'][$propName]['nullable'] = true;
                                $addedProperties[] =
                                    $propName . " (made nullable because nullable in {$otherRouteType})";
                            }
                            break;
                        }
                    }
                }
            }

            if (!empty($addedProperties)) {
                echo "  → {$routeType}: added " . count($addedProperties) . " nullable properties: " .
                    implode(', ', $addedProperties) . "\n";
            } else {
                echo "  → {$routeType}: no properties added\n";
            }
        }
    }

    /**
     * Create a nullable version of a property
     */
    private function createNullableProperty(array $originalProperty): array
    {
        $nullableProp = $originalProperty;

        // If it's a reference, make it nullable
        if (isset($nullableProp['$ref'])) {
            return [
                'anyOf' => [
                    ['$ref' => $nullableProp['$ref']],
                    ['type' => 'null']
                ],
                'nullable' => true
            ];
        }

        // Otherwise, simply add nullable: true
        $nullableProp['nullable'] = true;

        return $nullableProp;
    }

    /**
     * Optional: Clean required properties that may cause issues
     */
    public function cleanRequiredProperties(): void
    {
        echo "\n🧹 Cleaning required properties...\n";

        foreach ($this->routeTypes as $routeType) {
            if (!isset($this->schema['components']['schemas'][$routeType]['required'])) {
                continue;
            }

            $route = &$this->schema['components']['schemas'][$routeType];
            $required = $route['required'] ?? [];
            $properties = $route['properties'] ?? [];

            // Keep only required properties that are not nullable
            $cleanRequired = array_filter($required, function ($propName) use ($properties) {
                $prop = $properties[$propName] ?? null;
                return $prop && !($prop['nullable'] ?? false);
            });

            $removedCount = count($required) - count($cleanRequired);

            if ($removedCount > 0) {
                $route['required'] = array_values($cleanRequired);
                echo "  → {$routeType}: removed {$removedCount} required properties that became nullable\n";
            }
        }
    }

    /**
     * Save the modified schema
     */
    public function save(string $outputPath): void
    {
        // Transform empty arrays to objects before encoding
        $data = $this->forceEmptyObjects($this->schema);

        // Encode to JSON
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        if (file_put_contents($outputPath, $json) === false) {
            throw new RuntimeException("Unable to write file: {$outputPath}");
        }

        echo "\n✅ Modified schema saved: {$outputPath}\n";
    }

    /**
     * Show a report of modifications
     */
    public function showReport(): void
    {
        echo "\n📊 Modification report:\n";

        foreach ($this->routeTypes as $routeType) {
            if (!isset($this->schema['components']['schemas'][$routeType])) {
                continue;
            }

            $properties = $this->schema['components']['schemas'][$routeType]['properties'] ?? [];
            $nullableCount = 0;

            foreach ($properties as $prop) {
                if ($prop['nullable'] ?? false) {
                    $nullableCount++;
                }
            }

            echo "  → {$routeType}: " . count($properties) . " total properties, {$nullableCount} nullable\n";
        }
    }

    /**
     * check if project.subscription.id field exists
     * and raise an error to use it in the function
     *  - ProjectTask.delete()
     *  - SupportTicketTask.listCategories()
     *  - SupportTicketTask.listPriorities()
     * @throws Exception
     */
    public function checkProjectSubscriptionId(): void
    {
        $project = &$this->schema['components']['schemas']['Project'];

        // check if project.subscription.id has been introduced
        if (isset($project['properties']['subscription']['properties']['id'])) {
            throw new Exception(
                'Project.subscription.id has been introduced, please review ProjectTask.delete function to use it'
            );
        }
    }

    /**
     * Remove Project->Delete path till it's not exposed public (x-internal: true)
     * @return void
     */
    public function removeProjectDeletePath()
    {
        if (isset($this->schema['paths']['/projects/{projectId}']['delete'])) {
            unset($this->schema['paths']['/projects/{projectId}']['delete']);
        }
    }

    private function replaceHTTPAccessPermission(string $content): string
    {
        return str_replace('HTTP access permissions', 'Http access permissions', $content);
    }

    public function addXReturn(): void
    {
        // Adding x-return info for better processing in the mustache template
        foreach ($this->schema['paths'] as $path => &$methods) {
            preg_match_all('/\{([^\}]+)\}/', $path, $matches);

            foreach ($methods as $httpMethod => &$operation) {
                if (!is_array($operation) || $httpMethod === "parameters") {
                    continue;
                }

                if (!empty($operation['operationId'])) {
                    $operation['x-property-id-kebab'] = $operation['operationId'];
                    echo "  → {$httpMethod} {$path} => {$operation['operationId']}\n";
                }

                if (!empty($operation['tags'])) {
                    $operation['x-tag-id-kebab'] = preg_replace('/\s+/', '-', $operation['tags'][0]);
                }

                // --- Remove "default": null if $ref exists in requestBody schema ---
                if (isset($operation['requestBody']['content']['application/json']['schema']['properties'])) {
                    $properties = $operation['requestBody']['content']['application/json']['schema']['properties'];
                    foreach ($properties as $key => &$prop) {
                        if (isset($prop['$ref']) && array_key_exists('default', $prop)) {
                            unset($prop['default']);
                        }
                    }
                }

                // --- Auto x-return-types ---
                $returnTypes = [];
                $phpDoc = [];
                $operation['x-return-types-displayReturn'] = false;

                if (isset($operation['responses']) && is_array($operation['responses'])) {
                    foreach ($operation['responses'] as $statusCode => $resp) {
                        // Only process success codes (2xx or default)
                        if (
                            (
                                !is_numeric($statusCode)
                                || $statusCode < 200
                                || $statusCode > 299
                            ) && $statusCode !== 'default'
                        ) {
                            continue;
                        }

                        $schema = null;
                        $contentTypes = array_keys($resp['content'] ?? []);

                        if (isset($resp['content']['application/json']['schema'])) {
                            $schema = $resp['content']['application/json']['schema'];
                        } elseif (isset($resp['content']['application/problem+json']['schema'])) {
                            $schema = $resp['content']['application/problem+json']['schema'];
                        } elseif (
                            isset($resp['content']['application/pdf']['schema'])
                            || in_array('application/pdf', $contentTypes, true)
                        ) {
                            $schema = ['type' => 'string', 'format' => 'binary'];
                        }

                        if ($schema && is_array($schema)) {
                            if (
                                isset($schema['type'])
                                && $schema['type'] === 'object'
                                && isset($schema['properties']['items']['$ref'])
                            ) {
                                $ref = $schema['properties']['items']['$ref'];
                                $parts = explode('/', $ref);
                                $class = '\\Upsun\\Model\\' . end($parts);
                                $refs = ['refs' => [$class . '[]']];
                            } else {
                                $refs = $this->collectMainRefs($schema, $this->schema);
                            }

                            $returnTypes = array_merge($returnTypes, $refs['refs'] ?? []);
                            $phpDoc = $refs['phpdoc'] ?? null;
                        } else {
                            // If no schema, guess type via content-type
                            if (in_array('application/pdf', $contentTypes, true)) {
                                $returnTypes[] = 'string';
                            } else {
                                $returnTypes[] = 'void';
                            }
                        }
                    }
                }

                // convert void|Error to null|Error
                if (in_array('void', $returnTypes, true) && count($returnTypes) > 1) {
                    $returnTypes = array_map(fn ($t) => $t === 'void' ? 'null' : $t, $returnTypes);
                }

                $operation['x-return-types'] = array_values(array_unique($returnTypes));

                // Convert `Model[]` to `array` for union type
                $unionTypes = array_map(function ($t) {
                    return str_ends_with($t, '[]') ? 'array' : $t;
                }, $returnTypes);

                $returnTypeUnion = implode('|', array_values(array_unique($unionTypes)));
                if ($returnTypeUnion && $returnTypeUnion !== 'object') {
                    $operation['x-return-types-union'] = $returnTypeUnion;
                }

                foreach ($returnTypes as $t) {
                    if (str_ends_with($t, '[]') || str_contains($t, 'array<')) {
                        $operation['x-return-types-displayReturn'] = true;
                        break;
                    }
                }

                // Determine if the operation has a real return type
                $hasReturn = false;
                foreach ($operation['responses'] as $statusCode => $resp) {
                    if (
                        (is_numeric($statusCode) && $statusCode >= 200 && $statusCode < 300)
                        || $statusCode === 'default'
                    ) {
                        $content = $resp['content'] ?? [];
                        if (!empty($content)) {
                            $hasReturn = true;
                            break;
                        }
                    }
                }

                $operation['x-phpdoc'] = $phpDoc;
                $operation['x-returnable'] = $hasReturn;
            }
        }
    }

    private function collectMainRefs(array $schema, array $spec): array
    {
        $refs = [
            'refs' => [],
            'phpdoc' => [],
        ];

        // Handle $ref directly
        if (isset($schema['$ref'])) {
            $resolved = $this->resolveRef($spec, $schema['$ref']);
            if (
                $resolved
                && isset($resolved['type']) && $resolved['type'] === 'array' && isset($resolved['items']['$ref'])
            ) {
                $parts = explode('/', $resolved['items']['$ref']);
                $class = '\\Upsun\\Model\\' . end($parts);
                $refs['refs'][] = $class . '[]';
                $refs['phpdoc']['return'] = $class . '[]';
            } else {
                $parts = explode('/', $schema['$ref']);
                $class = '\\Upsun\\Model\\' . end($parts);
                $refs['refs'][] = $class;
                $refs['phpdoc']['return'] = $class;
            }
            return $refs;
        }

        // Handle explicit type
        if (isset($schema['type'])) {
            switch ($schema['type']) {
                case 'array':
                    if (isset($schema['items']['$ref'])) {
                        $parts = explode('/', $schema['items']['$ref']);
                        $class = '\\Upsun\\Model\\' . end($parts);
                        $refs['refs'][] = $class . '[]';
                        $refs['phpdoc']['return'] = $class . '[]';
                    } elseif (isset($schema['items']['type'])) {
                        $type = $schema['items']['type'];
                        $refs['refs'][] = $type . '[]';
                        $refs['phpdoc']['return'] = $type . '[]';
                    }
                    return $refs;
                case 'object':
                    // Handle additionalProperties (key-value mapping)
                    if (isset($schema['additionalProperties'])) {
                        $additionalProps = $schema['additionalProperties'];

                        if (isset($additionalProps['$ref'])) {
                            // Case: additionalProperties with $ref
                            $parts = explode('/', $additionalProps['$ref']);
                            $class = '\\Upsun\\Model\\' . end($parts);
                            $refs['refs'][] = "array<string,$class>";
                            $refs['phpdoc']['return'] = "array<string,$class>";
                        } elseif (
                            isset($additionalProps['type'])
                            && $additionalProps['type'] === 'object'
                            && isset($additionalProps['properties'])
                        ) {
                            $refs['phpdoc']['return'] = true;
                        } elseif (isset($additionalProps['type'])) {
                            // Case: additionalProperties with primitive type
                            $type = $additionalProps['type'];
                            $refs['refs'][] = "array<string,$type>";
                            $refs['phpdoc']['return'] = "array<string,$type>";
                        }
                    } elseif (isset($schema['properties'])) {
                        // Handle regular object with defined properties
                        $refs['refs'][] = 'object';
                        $refs['phpdoc']['return'] = 'object';
                    } else {
                        // Generic object
                        $refs['refs'][] = 'object';
                        $refs['phpdoc']['return'] = 'object';
                    }
                    return $refs;
                case 'boolean':
                case 'string':
                case 'integer':
                    $refs['refs'][] = $schema['type'];
                    $refs['phpdoc']['return'] = false;
                    return $refs;
                case 'number':
                    $refs['refs'][] = 'float';
                    $refs['phpdoc']['return'] = false;
                    return $refs;
            }
        }

        return $refs;
    }

    private function resolveRef(array $spec, string $ref)
    {
        // Ex : $ref = "#/components/schemas/ActivityCollection"
        $parts = explode('/', $ref);
        $current = $spec;
        foreach ($parts as $part) {
            if ($part === '#' || $part === '') {
                continue;
            }
            if (!isset($current[$part])) {
                return null;
            }
            $current = $current[$part];
        }
        return $current;
    }

    // Helper function: convert empty arrays to stdClass to preserve object types
    private function forceEmptyObjects($data, array $path = [])
    {
        if (\is_array($data)) {
            $isSecurityNode = !empty($path) && end($path) === 'BearerAuth';
            if (empty($data) && !$isSecurityNode) {
                return new stdClass();
            }
            if (empty($data) && $isSecurityNode) {
                return [];
            } 

            $result = [];
            $isAssociative = array_keys($data) !== range(0, count($data) - 1);

            foreach ($data as $key => $value) {
                $result[$key] = $this->forceEmptyObjects($value, array_merge($path, [$key]));
            }

            return $isAssociative && empty($result) ? new stdClass() : $result;
        }

        return $data;
    }

    public function addResourcePath()
    {
        // ✅ New route
        $path = '/projects/{projectId}/environments/{environmentId}/deployments/next';

        // Check if path does not exist yet
        if (isset($this->schema['paths'][$path])) {
            echo "ℹ️ The path $path already exists — no changes made.\n";
            return;
        }

        if (isset($this->schema['paths'][$path]['patch'])) {
            echo "ℹ️ The PATCH already exists on $path — no changes made.\n";
            return;
        }

        // Add/Update Deployment PATCH
        $this->schema['paths'][$path]['patch'] = [
            'summary' => 'Update the next deployment',
            'description' => 'Update resources for either webapps, services, or workers in the next deployment.',
            'parameters' => [
                [
                    'name' => 'projectId',
                    'in' => 'path',
                    'required' => true,
                    'schema' => ['type' => 'string']
                ],
                [
                    'name' => 'environmentId',
                    'in' => 'path',
                    'required' => true,
                    'schema' => ['type' => 'string']
                ]
            ],
            'requestBody' => [
                'required' => true,
                'content' => [
                    'application/json' => [
                        'schema' => [
                            'type' => 'object',
                            'properties' => [
                                'webapps' => [
                                    'type' => 'object',
                                    'additionalProperties' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'resources' => [
                                                '$ref' => '#/components/schemas/ResourceConfig'
                                            ],
                                            'instance_count' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'description' => 'Number of instances to run for the webapp',
                                                'example' => 2
                                            ],
                                            'disk' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'title' => 'Disk Size',
                                                'description' => 'Size of the disk in Bytes for the webapp',
                                                'example' => 1024
                                            ]
                                        ]
                                    ]
                                ],
                                'services' => [
                                    'type' => 'object',
                                    'additionalProperties' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'resources' => [
                                                '$ref' => '#/components/schemas/ResourceConfig'
                                            ],
                                            'instance_count' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'description' => 'Number of instances to run for the service',
                                                'example' => 1
                                            ],
                                            'disk' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'title' => 'Disk Size',
                                                'description' => 'Size of the disk in Bytes for the service',
                                                'example' => 1024
                                            ]
                                        ]
                                    ]
                                ],
                                'workers' => [
                                    'type' => 'object',
                                    'additionalProperties' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'resources' => [
                                                '$ref' => '#/components/schemas/ResourceConfig'
                                            ],
                                            'instance_count' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'description' => 'Number of instances to run for the worker',
                                                'example' => 1
                                            ],
                                            'disk' => [
                                                'type' => 'integer',
                                                'nullable' => true,
                                                'title' => 'Disk Size',
                                                'description' => 'Size of the disk in Bytes for the worker',
                                                'example' => 1024
                                            ]
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ],
            'responses' => [
                'default' => [
                    'description' => 'Deployment successfully updated',
                    'content' => [
                        'application/json' => [
                            'schema' => [
                                '$ref' => "#/components/schemas/AcceptedResponse"
                            ]
                        ]
                    ]
                ]
            ],
            'tags' => ['Deployment'],
            'operationId' => 'update-projects-environments-deployments-next'
        ];

        // ✅ Simplified ResourceConfig
        $this->schema['components']['schemas']['ResourceConfig'] = [
            'type' => 'object',
            'properties' => [
                'profile_size' => [
                    'type' => 'string',
                    'nullable' => true,
                    'description' => 'Profile size (e.g. "0.5", "1", "2")',
                    'example' => '2'
                ]
            ]
        ];
    }

    public function fixAllRefsWithAllOf(mixed &$node): void
    {
        if (is_array($node)) {
            // If this node has a $ref and extra keys, wrap in allOf
            if (isset($node['$ref'])) {
                $extraKeys = array_diff_key($node, ['$ref' => true]);
                if (!empty($extraKeys)) {
                    $refPart = ['$ref' => $node['$ref']];
                    $node = [
                        'allOf' => [
                            $refPart,
                            $extraKeys
                        ]
                    ];

                    // Recurse inside allOf elements
                    foreach ($node['allOf'] as &$subNode) {
                        $this->fixAllRefsWithAllOf($subNode);
                    }

                    return; // Do not process already processed children
                }
            }

            // Recurse into other children
            foreach ($node as &$child) {
                $this->fixAllRefsWithAllOf($child);
            }
        }
    }

    public function fixEmptyParameters(): void
    {
        foreach ($this->schema['paths'] as $path => &$methods) {
            foreach ($methods as $method => &$operation) {
                if (isset($operation['parameters']) && $operation['parameters'] === []) {
                    unset($operation['parameters']);
                }
            }
        }
    }

    public function renameXInternal(): void
    {
        // on paths
        foreach ($this->schema['paths'] as &$methods) {
            foreach ($methods as &$operation) {
                if (isset($operation['x-internal'])) {
                    $operation['x-internal-doc'] = $operation['x-internal'];
                    unset($operation['x-internal']);
                }
            }
        }

        // on Components
        foreach ($this->schema['components']['schemas'] as &$schema) {
            if (isset($schema['x-internal'])) {
                $schema['x-internal-doc'] = $schema['x-internal'];
                unset($schema['x-internal']);
            }
        }
    }

    public function renameDeprecated(): void
    {
        // on paths
        foreach ($this->schema['paths'] as &$methods) {
            foreach ($methods as &$operation) {
                if (isset($operation['deprecated'])) {
                    $operation['x-deprecated'] = $operation['deprecated'];
                    unset($operation['deprecated']);
                }
            }
        }

        // on Components
        foreach ($this->schema['components']['schemas'] as &$schema) {
            foreach ($schema['properties'] ?? [] as &$prop) {
                if ($prop['deprecated'] ?? false) {
                    $prop['x-deprecated'] = $prop['deprecated'];
                    unset($prop['deprecated']);
                }
            }
        }
    }

    public function fixNullableRequired(): void
    {
        foreach ($this->schema['components']['schemas'] as &$schema) {
            foreach ($schema['properties'] ?? [] as $propName => &$prop) {
                if (($prop['nullable'] ?? false) && isset($prop['required'])) {
                    // Remove required fields from nullable objects
                    unset($prop['required']);
                }
            }
        }
    }

    /**
     * Mark properties as DateTime if their OpenAPI format is "date-time"
     */
    public function markDateTimeProperties(): void
    {
        echo "🔍 Marking all date-time properties in all schemas...\n";

        foreach ($this->schema['components']['schemas'] as $schemaName => &$schema) {
            if (array_key_exists('properties', $schema)) {
                foreach ($schema['properties'] as $propName => &$propDefinition) {
                    // Add flag isDateTime if type is string and format is date-time
                    if (
                        ($propDefinition['type'] ?? '') === 'string'
                        && ($propDefinition['format'] ?? '') === 'date-time'
                    ) {
                        $propDefinition['x-isDateTime'] = true;
                    } else {
                        if (!array_key_exists('$ref', $propDefinition) && $propName !== '_links') {
                            $propDefinition['x-isDateTime'] = false;
                        }
                    }
                }
            }
        }

        echo "✅ DateTime marking completed for all schemas.\n";
    }

    public function addOrgAddonsPatch(): void
    {
        $path = '/organizations/{organization_id}/addons';

        // Check if the path already exists
        if (!isset($this->schema['paths'][$path])) {
            echo "⚠️ The path $path does not exist, creating it completely.\n";
            $this->schema['paths'][$path] = [];
        }

        // Add the PATCH operation
        $this->schema['paths'][$path]['patch'] = [
            'summary' => 'Update organization add-ons',
            'description' => 'Updates the add-ons configuration for an organization.',
            'operationId' => 'update-org-addons',
            'tags' => ['Add-ons'],
            'parameters' => [
                [
                    '$ref' => '#/components/parameters/OrganizationIDName'
                ]
            ],
            'requestBody' => [
                'required' => true,
                'content' => [
                    'application/json' => [
                        'schema' => [
                            'type' => 'object',
                            'properties' => [
                                'user_management' => [
                                    'type' => 'string',
                                    'description' => 'The user management level to apply.',
                                    'enum' => ['standard', 'enhanced'],
                                    'example' => 'standard'
                                ],
                                'support_level' => [
                                    'type' => 'string',
                                    'description' => 'The support level to apply.',
                                    'enum' => ['basic', 'premium'],
                                    'example' => 'basic'
                                ]
                            ],
                            'additionalProperties' => false,
                            'minProperties' => 1 // at least one of the properties must be present
                        ]
                    ]
                ]
            ],
            'responses' => [
                '200' => [
                    'description' => 'Add-ons updated successfully',
                    'content' => [
                        'application/json' => [
                            'schema' => [
                                '$ref' => '#/components/schemas/OrganizationAddonsObject'
                            ]
                        ]
                    ]
                ],
                '400' => [
                    'description' => 'Bad Request',
                    'content' => [
                        'application/problem+json' => [
                            'schema' => [
                                '$ref' => '#/components/schemas/Error'
                            ]
                        ]
                    ]
                ],
                '403' => [
                    'description' => 'Forbidden',
                    'content' => [
                        'application/problem+json' => [
                            'schema' => [
                                '$ref' => '#/components/schemas/Error'
                            ]
                        ]
                    ]
                ],
                '404' => [
                    'description' => 'Not Found',
                    'content' => [
                        'application/problem+json' => [
                            'schema' => [
                                '$ref' => '#/components/schemas/Error'
                            ]
                        ]
                    ]
                ]
            ],
            'x-vendor' => 'upsun'
        ];

        echo "✅ PATCH operation added for $path\n";
    }

    public function wordwrapDescription(): void
    {
        // on paths
        foreach ($this->schema['paths'] as &$methods) {
            foreach ($methods as &$operation) {
                if (isset($operation['description'])) {
                    $operation['x-description'] = $this->preprocessDescription($operation['description']);
                }
            }
        }

        // on Components
        foreach ($this->schema['components']['schemas'] as &$schema) {
            $this->wordwrapSchemaDescription($schema);
        }

        foreach ($this->schema['components']['parameters'] as &$schema) {
            $this->wordwrapSchemaDescription($schema, 80);
        }
    }

    private function wordwrapSchemaDescription(array &$schema, int $wordwrapLength = 113): void
    {
        // schema.description
        if (!empty($schema['description'])) {
            $schema['x-description'] = $this->preprocessDescription($schema['description'], $wordwrapLength);
        }

        // property description
        if (!empty($schema['properties']) && is_array($schema['properties'])) {
            foreach ($schema['properties'] as &$prop) {
                if (!empty($prop['description'])) {
                    $prop['x-description'] = $this->preprocessDescription($prop['description'], $wordwrapLength);
                }

                // recursive if property is an object
                if (!empty($prop['properties']) && is_array($prop['properties'])) {
                    $this->wordwrapSchemaDescription($prop);
                }
            }
        }

        // loop on allOf / anyOf / oneOf
        foreach (['allOf', 'anyOf', 'oneOf'] as $key) {
            if (!empty($schema[$key]) && is_array($schema[$key])) {
                foreach ($schema[$key] as &$subSchema) {
                    $this->wordwrapSchemaDescription($subSchema);
                }
            }
        }
    }

    public function preprocessDescription(string $description, int $wordwrapLength = 113): array
    {
        // Replace Markdown links with absolute Upsun URLs
        $description = preg_replace_callback(
            '/\[([^\]]+)\]\((#[^)]+)\)/',
            function ($matches) {
                $text = $matches[1];
                $anchor = $matches[2];
                $url = 'https://docs.upsun.com/api/' . $anchor;

                // Decode JSON Pointer style
                $url = str_replace('~1', '/', $url);
                $url = str_replace(['%7B', '%7D'], ['{', '}'], $url);

                return $text . ' (' . $url . ')';
            },
            $description
        );

        // Replace %2F with "/"
        $description = str_replace('%2F', '/', $description);

        // Normalize whitespace
        $normalized = preg_replace('/\s+/', ' ', trim($description));

        // Remove <br> tags
        $normalized = preg_replace('/<br\s*\/?>/i', '', $normalized);

        // Wrap
        $lines = wordwrap($normalized, $wordwrapLength, "\n", false);

        return explode("\n", $lines);
    }

    public function replaceEmptyRefResponsesWithAccepted(): void
    {
        foreach ($this->schema['paths'] as $path => &$methods) {
            foreach ($methods as $httpMethod => &$operation) {
                $responses = $operation['responses'] ?? null;
                if (!is_array($responses)) {
                    continue;
                }

                foreach ($responses as $statusCode => &$response) {
                    $schemaRef = $response['content']['application/json']['schema']['$ref'] ?? null;
                    if (!$schemaRef) {
                        continue; // no $ref
                    }

                    $refName = basename($schemaRef);
                    $schemaDef = $this->schema['components']['schemas'][$refName] ?? null;

                    // Check if empty schema
                    $isEmpty = false;
                    if ($schemaDef === null) {
                        $isEmpty = true; // schema does not exist
                    } elseif (
                        empty($schemaDef['properties'])
                        && empty($schemaDef['oneOf'])
                        && empty($schemaDef['allOf'])
                        && empty($schemaDef['anyOf'])
                    ) {
                        $isEmpty = true; // existing empty schema
                    }

                    if ($isEmpty) {
                        // Replace with AcceptedResponse
                        $response['content']['application/json']['schema'] = [
                            '$ref' => '#/components/schemas/AcceptedResponse',
                        ];

                        echo "🔄 Replaced empty \$ref $refName with AcceptedResponse" 
                        ." for {$httpMethod} {$path} [$statusCode]\n";
                    }
                }
            }
        }
    }

    /**
     * Iterates over all schemas and renames their keys to PascalCase
     * Also updates all corresponding $ref references
     */
    public function normalizeSchemaNamesToPascalCase(): void
    {
        if (!isset($this->schema['components']['schemas'])) {
            echo "⚠️ No schemas found in components.schemas\n";
            return;
        }

        $schemas = $this->schema['components']['schemas'];
        $newSchemas = [];
        $renameMap = [];

        foreach ($schemas as $schemaName => $schemaDef) {
            $pascalName = $this->toPascalCase($schemaName);

            if ($pascalName !== $schemaName) {
                $renameMap[$schemaName] = $pascalName;
                echo "🔤 Rename schema '{$schemaName}' → '{$pascalName}'\n";
            }

            $newSchemas[$pascalName] = $schemaDef;
        }

        $this->schema['components']['schemas'] = $newSchemas;

        if (!empty($renameMap)) {
            $this->updateRefsRecursively($this->schema, $renameMap);
            echo "✅ {$this->refUpdateCount} ref \$ref updated.\n";
        }
    }

    /**
     * Recursively updates all $ref references
     * (in schemas, responses, parameters, paths, etc.)
     */
    private function updateRefsRecursively(array &$node, array $renameMap): void
    {
        foreach ($node as $key => &$value) {
            if (is_array($value)) {
                $this->updateRefsRecursively($value, $renameMap);
            } elseif ($key === '$ref' && is_string($value)) {
                foreach ($renameMap as $old => $new) {
                    $oldRef = "#/components/schemas/{$old}";
                    $newRef = "#/components/schemas/{$new}";
                    if ($value === $oldRef) {
                        $value = $newRef;
                        $this->refUpdateCount++;
                        echo "🔁 \$ref mis à jour : {$oldRef} → {$newRef}\n";
                    }
                }
            }
        }
    }

    public function fixTagsToPascalCase(): void
    {
        if (!isset($this->schema['paths'])) {
            return;
        }

        foreach ($this->schema['paths'] as &$methods) {
            foreach ($methods as &$operation) {
                if (!isset($operation['tags']) || !is_array($operation['tags'])) {
                    continue;
                }

                foreach ($operation['tags'] as $i => $tag) {
                    $operation['tags'][$i] = $this->toPascalCase($tag);
                }
            }
        }
    }

    /**
     * Converts a string to PascalCase
     * Examples:
     *  - api_token → ApiToken
     *  - user → User
     *  - ApiToken → ApiToken
     */
    private function toPascalCase(string $name): string
    {
        $name = str_replace(['API'], 'Api', $name);
        $name = str_replace(['SSH'], 'Ssh', $name);
        $name = str_replace(['MFA'], 'Mfa', $name);
        $name = str_replace(['TLS'], 'Tls', $name);
        $name = str_replace(['VPN'], 'Vpn', $name);
        return $name;
    }

    public function addUniqueDiscriminatorModels(): void
    {
        foreach ($this->schema['components']['schemas'] as $schemaName => &$schema) {
            if (isset($schema['discriminator']['mapping'])) {
                $mapping = $schema['discriminator']['mapping'];
                $uniqueModels = array_unique(array_map(function ($ref) {
                    return basename($ref);
                }, $mapping));
                $schema['x-uniqueDiscriminatorModels'] = array_values($uniqueModels);
                echo "→ Add x-uniqueDiscriminatorModels on $schemaName : " . implode(', ', $uniqueModels) . "\n";
            }
        }
    }
}

# Main script
try {
    echo "Usage: php preprocess-schema.php <path-to-schema.json> [output-path]\n";
    echo "Example: php preprocess-schema.php ./openapi.json ./openapi-processed.json\n";

    $inputPath = $argv[1] ?? './resources/openapi/openapispec-upsun.json';
    $outputPath = $argv[2] ?? str_replace('.json', '-sdks.json', $inputPath);

    echo "🚀 Starting OpenAPI schema preprocessing\n";
    echo "📁 Input: {$inputPath}\n";
    echo "📁 Output: {$outputPath}\n\n";

    $preprocessor = new OpenApiPreprocessor($inputPath);

    // check Project.subscription.id exists and raise an error to solve ProjectTask.delete
    $preprocessor->checkProjectSubscriptionId();

    // Schema name in PascalCase
    $preprocessor->normalizeSchemaNamesToPascalCase();
    $preprocessor->fixTagsToPascalCase();

    // Main processing
    $preprocessor->makePropertiesNullable();

    // Set DateTime flag on properties
    $preprocessor->markDateTimeProperties();

    // Optional: clean required properties
    $preprocessor->cleanRequiredProperties();

    // Add addons update path (PATCH)
    $preprocessor->addOrgAddonsPatch();

    // Remove Project->delete path
    $preprocessor->removeProjectDeletePath();

    // Fix empty parameters
    $preprocessor->fixEmptyParameters();

    // replace empty response object
    $preprocessor->replaceEmptyRefResponsesWithAccepted();

    // Add deployment/next path for managing resources
    $preprocessor->addResourcePath();

    // Fix nullable/required
    $preprocessor->fixNullableRequired();

    // rename x-internal --> x-internal-doc
    $preprocessor->renameXInternal();

    // rename deprecated --> x-deprecated
    $preprocessor->renameDeprecated();

    // Add x-return-* properties
    $preprocessor->addXReturn();

    // wordwrap description
    $preprocessor->wordwrapDescription();

    // Fix discriminator unique models
    $preprocessor->addUniqueDiscriminatorModels();

    // Save
    $preprocessor->save($outputPath);

    // Report
    $preprocessor->showReport();

    echo "\n🎉 Preprocessing completed successfully!\n";
    echo "You can now use '{$outputPath}' with openapi-generator-cl in your SDKs\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
