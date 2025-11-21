# Trust-Registry - Resources Configuration

This project supports two resource loading modes: **local** and **GitHub**.

## 🎯 Data Source

The `registry.json` file comes from the official Upsun repository:
- **URL**: https://raw.githubusercontent.com/upsun/upsun-docs/main/shared/data/registry.json
- **Repository**: https://github.com/upsun/upsun-docs

## 🔧 Configuration

### 1. Create the `.env` File

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

### 2. Configure Resource Mode

#### GitHub Mode (Recommended - Production)

## Loading Modes

### GitHub Mode (Default)

To load resources from the official Upsun repository:

```env
RESOURCE_MODE=github
GITHUB_REPO_OWNER=upsun
GITHUB_REPO_NAME=upsun-docs
GITHUB_REGISTRY_PATH=shared/data/registry.json
```

**No token required** as the repository is public!

#### Local Mode (Development)

To use local files during development:

```env
RESOURCES_MODE=local
LOCAL_RESOURCES_PATH=../../resources
```

## 📁 Resource Structure

### From Upsun (GitHub Mode)
The main file is `registry.json` located at:
```
upsun-docs/
└── shared/
    └── data/
        └── registry.json  ← File used
```

### Local (Local Mode)
Resources must be organized as follows:

```
resources/
└── image/
    └── registry.json
```

## 🚀 Usage

### Available Endpoints

1. **GET /** - API information and active resource mode
2. **GET /image** - Complete registry list of all images
3. **GET /image/:name** - Versions of a specific image (e.g., `/image/nodejs`)

### Examples

```bash
# Get all Node.js versions
curl http://localhost:3000/image/nodejs

# Response:
{
  "deprecated": ["18", "16", "14", "12", ...],
  "supported": ["24", "22", "20"]
}

# Get all Chrome Headless versions
curl http://localhost:3000/image/chrome-headless

# Response:
{
  "deprecated": ["73", "80", "81", "83", "84", "86"],
  "supported": ["120", "113", "95", "91"],
  "legacy": []
}
```

## 🔄 Switching Between Modes

### In Development
```env
RESOURCES_MODE=local
```

### In Production
```env
RESOURCES_MODE=github
GITHUB_REPO_OWNER=platform-sh
GITHUB_REPO_NAME=trust-api-resources
GITHUB_BRANCH=main
```

## 📝 Creating a GitHub Token

To access a private repository:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a new token (classic)
3. Select the `repo` scope for private repository access
4. Copy the token into your `.env`:
   ```env
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

## ⚠️ Important

- **NEVER** commit the `.env` file (already in `.gitignore`)
- The `.env.example` file serves as a template
- The GitHub token must remain secret
