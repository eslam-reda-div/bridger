<?php
/**
 * Bridger PHP Worker - Persistent worker process for the PHP runtime bridge.
 * Communicates via newline-delimited JSON over stdin/stdout.
 *
 * Protocol:
 *   Request:  { "id": int, "type": str, ... }
 *   Response: { "id": int, "result": any } | { "id": int, "error": str }
 */

// Load Composer autoload if path provided
$autoloadPath = $argv[1] ?? null;
if ($autoloadPath && file_exists($autoloadPath)) {
    require_once $autoloadPath;
}

class ObjectRegistry
{
    private array $objects = [];
    private int $counter = 0;

    public function store($obj): string
    {
        $this->counter++;
        $refId = "phpref_{$this->counter}";
        $this->objects[$refId] = $obj;
        return $refId;
    }

    public function get(string $refId)
    {
        if (!isset($this->objects[$refId])) {
            throw new RuntimeException("Object reference not found: {$refId}");
        }
        return $this->objects[$refId];
    }

    public function delete(string $refId): void
    {
        unset($this->objects[$refId]);
    }

    public function deleteMany(array $refs): void
    {
        foreach ($refs as $refId) {
            unset($this->objects[$refId]);
        }
    }

    public function has(string $refId): bool
    {
        return isset($this->objects[$refId]);
    }

    public function count(): int
    {
        return count($this->objects);
    }
}

class Serializer
{
    private ObjectRegistry $registry;

    public function __construct(ObjectRegistry $registry)
    {
        $this->registry = $registry;
    }

    public function serialize($value)
    {
        if (is_null($value))
            return null;
        if (is_bool($value))
            return $value;
        if (is_int($value) || is_float($value))
            return $value;
        if (is_string($value))
            return $value;

        if (is_array($value)) {
            // Check if sequential (list) or associative (dict)
            if (empty($value))
                return [];
            $keys = array_keys($value);
            $isSequential = ($keys === range(0, count($value) - 1));

            if ($isSequential) {
                return array_map([$this, 'serialize'], $value);
            } else {
                $result = new \stdClass();
                foreach ($value as $k => $v) {
                    $key = (string) $k;
                    $result->$key = $this->serialize($v);
                }
                return $result;
            }
        }

        if (is_object($value)) {
            // Store object as reference
            $refId = $this->registry->store($value);
            $className = get_class($value);

            $repr = "<{$className}>";
            if (method_exists($value, '__toString')) {
                try {
                    $repr = (string) $value;
                    if (strlen($repr) > 500) {
                        $repr = substr($repr, 0, 500) . '...';
                    }
                } catch (\Throwable $e) {
                    $repr = "<{$className}>";
                }
            }

            $result = [
                '__bridger_ref__' => $refId,
                '__type__' => $className,
                '__repr__' => $repr,
            ];

            // Detect capabilities
            if ($value instanceof \Countable || method_exists($value, 'count')) {
                try {
                    $result['__len__'] = count($value);
                } catch (\Throwable $e) {
                }
            }
            if ($value instanceof \ArrayAccess) {
                $result['__indexable__'] = true;
            }
            if ($value instanceof \IteratorAggregate || $value instanceof \Iterator) {
                $result['__iterable__'] = true;
            }
            if (method_exists($value, '__invoke')) {
                $result['__callable__'] = true;
            }

            return $result;
        }

        if (is_resource($value)) {
            return ['__type__' => 'resource', '__repr__' => (string) $value];
        }

        return null;
    }

    public function deserialize($value)
    {
        if (is_null($value) || is_bool($value) || is_int($value) || is_float($value) || is_string($value)) {
            return $value;
        }
        if (is_array($value)) {
            if (isset($value['__bridger_ref__'])) {
                return $this->registry->get($value['__bridger_ref__']);
            }
            return array_map([$this, 'deserialize'], $value);
        }
        if (is_object($value)) {
            $result = [];
            foreach ($value as $k => $v) {
                $result[$k] = $this->deserialize($v);
            }
            return $result;
        }
        return $value;
    }
}

class BridgerPHPWorker
{
    private ObjectRegistry $registry;
    private Serializer $serializer;

    public function __construct()
    {
        $this->registry = new ObjectRegistry();
        $this->serializer = new Serializer($this->registry);
    }

    public function handle(array $msg): array
    {
        $id = $msg['id'] ?? null;
        $type = $msg['type'] ?? '';

        try {
            $method = 'handle_' . $type;
            if (!method_exists($this, $method)) {
                return ['id' => $id, 'error' => "Unknown message type: {$type}"];
            }
            return $this->$method($msg);
        } catch (\Throwable $e) {
            return [
                'id' => $id,
                'error' => $e->getMessage(),
                'errorType' => get_class($e),
                'traceback' => $e->getTraceAsString(),
            ];
        }
    }

    /**
     * Call a global PHP function.
     * { type: "call_function", function: "array_merge", args: [...] }
     */
    private function handle_call_function(array $msg): array
    {
        $function = $msg['function'];
        $args = array_map([$this->serializer, 'deserialize'], $msg['args'] ?? []);

        if (!function_exists($function)) {
            throw new RuntimeException("Function not found: {$function}");
        }

        $result = call_user_func_array($function, $args);
        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
    }

    /**
     * Call a static method on a class.
     * { type: "call_static", class: "Namespace\\Class", method: "methodName", args: [...] }
     */
    private function handle_call_static(array $msg): array
    {
        $className = $msg['class'];
        $method = $msg['method'];
        $args = array_map([$this->serializer, 'deserialize'], $msg['args'] ?? []);

        if (!class_exists($className)) {
            throw new RuntimeException("Class not found: {$className}. Make sure the package is installed.");
        }

        $result = call_user_func_array([$className, $method], $args);
        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
    }

    /**
     * Call a method on a stored object instance.
     * { type: "call_method", ref: "phpref_1", method: "methodName", args: [...] }
     */
    private function handle_call_method(array $msg): array
    {
        $refId = $msg['ref'];
        $method = $msg['method'];
        $args = array_map([$this->serializer, 'deserialize'], $msg['args'] ?? []);

        $obj = $this->registry->get($refId);
        $result = call_user_func_array([$obj, $method], $args);
        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
    }

    /**
     * Create a new instance of a class.
     * { type: "create_instance", class: "Namespace\\Class", args: [...] }
     */
    private function handle_create_instance(array $msg): array
    {
        $className = $msg['class'];
        $args = array_map([$this->serializer, 'deserialize'], $msg['args'] ?? []);

        if (!class_exists($className)) {
            throw new RuntimeException("Class not found: {$className}. Make sure the package is installed.");
        }

        $reflection = new \ReflectionClass($className);
        if (empty($args)) {
            $instance = $reflection->newInstance();
        } else {
            $instance = $reflection->newInstanceArgs($args);
        }

        $refId = $this->registry->store($instance);
        return [
            'id' => $msg['id'],
            'result' => [
                '__bridger_ref__' => $refId,
                '__type__' => $className,
            ],
        ];
    }

    /**
     * Get a static property or constant from a class.
     * { type: "get_static", class: "Namespace\\Class", property: "PROP_NAME" }
     */
    private function handle_get_static(array $msg): array
    {
        $className = $msg['class'];
        $property = $msg['property'];

        if (!class_exists($className)) {
            throw new RuntimeException("Class not found: {$className}");
        }

        $reflection = new \ReflectionClass($className);

        // Try constant first
        if ($reflection->hasConstant($property)) {
            $result = $reflection->getConstant($property);
            return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
        }

        // Try static property
        if ($reflection->hasProperty($property)) {
            $prop = $reflection->getProperty($property);
            if ($prop->isStatic()) {
                $prop->setAccessible(true);
                $result = $prop->getValue();
                return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
            }
        }

        throw new RuntimeException("Static property or constant '{$property}' not found on {$className}");
    }

    /**
     * Get a property from a stored object instance.
     * { type: "get_property", ref: "phpref_1", property: "propName" }
     */
    private function handle_get_property(array $msg): array
    {
        $refId = $msg['ref'];
        $property = $msg['property'];

        $obj = $this->registry->get($refId);
        $result = $obj->$property;
        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
    }

    /**
     * Introspect a class to discover its members.
     * { type: "introspect_class", class: "Namespace\\Class" }
     */
    private function handle_introspect_class(array $msg): array
    {
        $className = $msg['class'];

        if (!class_exists($className)) {
            throw new RuntimeException("Class not found: {$className}");
        }

        $reflection = new \ReflectionClass($className);
        $methods = [];
        $staticMethods = [];
        $properties = [];
        $constants = [];

        foreach ($reflection->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
            $params = [];
            foreach ($method->getParameters() as $param) {
                $paramInfo = $param->getName();
                if ($param->hasType()) {
                    $paramInfo = $param->getType() . ' $' . $paramInfo;
                } else {
                    $paramInfo = '$' . $paramInfo;
                }
                if ($param->isOptional() && $param->isDefaultValueAvailable()) {
                    $paramInfo .= ' = ' . json_encode($param->getDefaultValue());
                }
                $params[] = $paramInfo;
            }

            $info = [
                'name' => $method->getName(),
                'params' => $params,
            ];

            if ($method->isStatic()) {
                $staticMethods[] = $info;
            } else {
                $methods[] = $info;
            }
        }

        foreach ($reflection->getProperties(\ReflectionProperty::IS_PUBLIC) as $prop) {
            $properties[] = [
                'name' => $prop->getName(),
                'static' => $prop->isStatic(),
            ];
        }

        foreach ($reflection->getConstants() as $name => $value) {
            $constants[] = [
                'name' => $name,
                'value' => $this->serializer->serialize($value),
            ];
        }

        return [
            'id' => $msg['id'],
            'result' => [
                'name' => $className,
                'methods' => $methods,
                'staticMethods' => $staticMethods,
                'properties' => $properties,
                'constants' => $constants,
                'parent' => $reflection->getParentClass() ? $reflection->getParentClass()->getName() : null,
            ]
        ];
    }

    /**
     * Navigate a chain of properties / methods on a stored object.
     * { type: "call_chain", ref: "phpref_1", chain: [{method: "filter", args: [...]}, {property: "values"}] }
     */
    private function handle_call_chain(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $chain = $msg['chain'] ?? [];

        foreach ($chain as $step) {
            if (isset($step['method'])) {
                $args = array_map([$this->serializer, 'deserialize'], $step['args'] ?? []);
                $obj = call_user_func_array([$obj, $step['method']], $args);
            } elseif (isset($step['property'])) {
                $obj = $obj->{$step['property']};
            }
        }

        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($obj)];
    }

    /**
     * Array access: $obj[$key]
     */
    private function handle_getitem(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $key = $this->serializer->deserialize($msg['key']);

        if ($obj instanceof \ArrayAccess) {
            $result = $obj[$key];
        } elseif (is_array($obj)) {
            $result = $obj[$key];
        } elseif (is_object($obj) && isset($obj->$key)) {
            $result = $obj->$key;
        } else {
            throw new RuntimeException("Object does not support array access");
        }

        return ['id' => $msg['id'], 'result' => $this->serializer->serialize($result)];
    }

    /**
     * Array set: $obj[$key] = $value
     */
    private function handle_setitem(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $key = $this->serializer->deserialize($msg['key']);
        $value = $this->serializer->deserialize($msg['value']);

        if ($obj instanceof \ArrayAccess) {
            $obj[$key] = $value;
        } elseif (is_array($obj)) {
            $obj[$key] = $value;
        } else {
            throw new RuntimeException("Object does not support array access");
        }

        return ['id' => $msg['id'], 'result' => true];
    }

    /**
     * Get count/length of an object.
     */
    private function handle_count(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);

        if ($obj instanceof \Countable || is_array($obj)) {
            return ['id' => $msg['id'], 'result' => count($obj)];
        }

        throw new RuntimeException("Object is not countable");
    }

    /**
     * Convert iterable object to array.
     */
    private function handle_iter(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $limit = $msg['limit'] ?? 10000;
        $items = [];
        $i = 0;

        foreach ($obj as $value) {
            $items[] = $this->serializer->serialize($value);
            if (++$i >= $limit)
                break;
        }

        return ['id' => $msg['id'], 'result' => $items];
    }

    /**
     * Set a property on a stored object.
     */
    private function handle_set_property(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $property = $msg['property'];
        $value = $this->serializer->deserialize($msg['value']);
        $obj->$property = $value;
        return ['id' => $msg['id'], 'result' => true];
    }

    /**
     * Get string representation of object.
     */
    private function handle_repr(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        if (method_exists($obj, '__toString')) {
            $result = (string) $obj;
        } else {
            $result = print_r($obj, true);
        }
        if (strlen($result) > 10000) {
            $result = substr($result, 0, 10000) . '...';
        }
        return ['id' => $msg['id'], 'result' => $result];
    }

    /**
     * Get type info for a stored object.
     */
    private function handle_type(array $msg): array
    {
        $obj = $this->registry->get($msg['ref']);
        $class = get_class($obj);
        $interfaces = class_implements($obj) ?: [];
        $parents = class_parents($obj) ?: [];

        return [
            'id' => $msg['id'],
            'result' => [
                'type' => $class,
                'interfaces' => array_values($interfaces),
                'parents' => array_values($parents),
            ]
        ];
    }

    /**
     * Release multiple stored object references at once.
     */
    private function handle_destroy_many(array $msg): array
    {
        $this->registry->deleteMany($msg['refs']);
        return ['id' => $msg['id'], 'result' => true];
    }

    /**
     * Return worker status info.
     */
    private function handle_info(array $msg): array
    {
        return [
            'id' => $msg['id'],
            'result' => [
                'php_version' => PHP_VERSION,
                'platform' => PHP_OS,
                'objects_tracked' => $this->registry->count(),
                'pid' => getmypid(),
            ]
        ];
    }

    /**
     * Release a stored object reference.
     */
    private function handle_destroy(array $msg): array
    {
        $this->registry->delete($msg['ref']);
        return ['id' => $msg['id'], 'result' => true];
    }

    private function handle_ping(array $msg): array
    {
        return ['id' => $msg['id'], 'result' => 'pong'];
    }

    private function handle_batch(array $msg): array
    {
        $messages = $msg['messages'] ?? [];
        $results = [];
        foreach ($messages as $subMsg) {
            $results[] = $this->handle($subMsg);
        }
        return ['id' => $msg['id'], 'result' => $results];
    }

    /**
     * Generic introspect handler — delegates to introspect_class.
     * Supports: { type: "introspect", class: "ClassName" }
     *       or: { type: "introspect", ref: "phpref_X" }
     */
    private function handle_introspect(array $msg): array
    {
        if (isset($msg['class'])) {
            return $this->handle_introspect_class($msg);
        }
        if (isset($msg['ref'])) {
            $obj = $this->registry->get($msg['ref']);
            $className = get_class($obj);
            $msg['class'] = $className;
            return $this->handle_introspect_class($msg);
        }
        return ['id' => $msg['id'], 'error' => 'introspect requires "class" or "ref"'];
    }

    /**
     * Import handler (no-op for PHP — autoloading handles it).
     */
    private function handle_import(array $msg): array
    {
        return ['id' => $msg['id'], 'result' => true];
    }

    /**
     * Import-from handler (no-op for PHP — autoloading handles it).
     */
    private function handle_import_from(array $msg): array
    {
        return ['id' => $msg['id'], 'result' => new \stdClass()];
    }

    private function handle_shutdown(array $msg): array
    {
        return ['id' => $msg['id'], 'result' => true, '__shutdown__' => true];
    }

    public function run(): void
    {
        // Signal readiness
        fwrite(STDOUT, json_encode(['type' => 'ready']) . "\n");
        fflush(STDOUT);

        while (($line = fgets(STDIN)) !== false) {
            $line = trim($line);
            if (empty($line))
                continue;

            $msg = json_decode($line, true);
            if ($msg === null) {
                fwrite(STDOUT, json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]) . "\n");
                fflush(STDOUT);
                continue;
            }

            $response = $this->handle($msg);
            fwrite(STDOUT, json_encode($response) . "\n");
            fflush(STDOUT);

            if (!empty($response['__shutdown__']))
                break;
        }
    }
}

$worker = new BridgerPHPWorker();
$worker->run();
