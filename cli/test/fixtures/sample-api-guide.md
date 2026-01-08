# API Documentation

This is an example API guide for testing the Doc Detective documentation parser.

## Getting Started

To get started with our API, you'll need to obtain an API key from the dashboard.

Navigate to https://api.example.com/dashboard and sign in with your credentials.

### Authentication

All API requests require authentication using your API key. Include it in the header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.example.com/v1/users
```

### Rate Limits

The API enforces rate limits of 100 requests per minute per API key.

## User Management

This section covers user-related endpoints.

### List Users

To retrieve a list of all users, send a GET request to `/v1/users`:

```http
GET /v1/users HTTP/1.1
Host: api.example.com
Authorization: Bearer YOUR_API_KEY
```

The response will include an array of user objects with the following fields:
- `id` - Unique user identifier
- `name` - User's full name
- `email` - User's email address

### Create User

To create a new user, send a POST request with the user details:

```http
POST /v1/users HTTP/1.1
Host: api.example.com
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

## Data Management

### Upload Data

You can upload data files using the `/v1/data/upload` endpoint.

Navigate to https://api.example.com/upload and use the file upload form.

### Download Data

To download your data, click the "Export" button in the dashboard.

## Troubleshooting

If you encounter errors, check the response status codes:

- 400: Bad Request - Check your request format
- 401: Unauthorized - Verify your API key
- 429: Too Many Requests - You've hit the rate limit
- 500: Server Error - Contact support

For more help, visit https://support.example.com
