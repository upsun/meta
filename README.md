# Trust-Registry - Source of Trust for Upsun

## 📋 Description

Trust-Registry is the central registry that provides reliable and up-to-date information about Upsun resources. This repository serves as the **Single Source of Trust** for all data related to container images and regions available on the Upsun platform.

The API will be accessible at https://meta.upsun.com/

## 🎯 Purpose

This project centralizes and exposes essential information through a REST API, such as:

- **Available Images**: complete list of container images, their versions, endpoints, and metadata
- **Upsun Regions**: geographic data, availability, and characteristics of cloud regions

As the single source of trust, this API ensures data consistency across all tools and services that depend on it.

## 🚀 Quick Start

```bash
cd backend
npm install
npm run dev
```

The API will be accessible at `http://localhost:3000`

## 📚 Interactive Documentation

A comprehensive interactive API documentation is automatically generated and accessible directly from the application. It provides:

- Complete list of available endpoints
- Request and response examples
- Detailed data schemas
- Built-in testing tool to explore the API

To access it, start the server and visit `http://localhost:3000/api-docs`.

## 🔍 Usage Examples

### Get all available images
```bash
GET /image
```

### Get a specific image
```bash
GET /image/{imageName}
```

### List all regions
```bash
GET /region
```

### Get region details
```bash
GET /region/{regionId}
```

### Get all PHP extensions (raw YAML content)
```bash
GET /extension
```

### Get extensions grouped for grid view
Returns entries shaped as `{ runtime, service, version, extensions[] }`.
```bash
GET /extension/grid
```

### Get extensions for a specific service
Example for `dedicated` service:
```bash
GET /extension/grid/dedicated
```
If the service does not exist, returns `404` with `availableServices`.

## 🏗️ Project Structure

- **backend/**: Express API server with TypeScript
- **resources/**: Source data (image registries, region configuration)
	- `extension/php_extensions.yaml`: List of PHP extensions per service and version

## 🔐 Source of Trust

This project is designed to be the single, reliable reference for all Upsun resource information. Any modification to the source data in this repository automatically propagates through the API, ensuring consistency and accuracy of information.
