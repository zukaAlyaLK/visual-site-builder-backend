import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Visual Site Builder API',
      version: '1.0.0',
      description: 'Backend API documentation',
    },
    tags: [
      { name: 'Health' },
      { name: 'Authorization' },
      { name: 'Projects' },
      { name: 'Uploads' },
    ],
    servers: [
      {
        url: 'http://localhost:3001',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['Health'],
          security: [],
          responses: {
            '200': {
              description: 'Service is healthy',
            },
          },
        },
      },
      '/api/auth/register': {
        post: {
          summary: 'Register user',
          tags: ['Authorization'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'User registered' },
            '409': { description: 'Email already exists' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Login',
          tags: ['Authorization'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Logged in' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          summary: 'Get current user',
          tags: ['Authorization'],
          responses: {
            '200': { description: 'User info' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/projects': {
        get: {
          summary: 'List projects',
          tags: ['Projects'],
          responses: {
            '200': { description: 'Projects list' },
          },
        },
        post: {
          summary: 'Create project',
          tags: ['Projects'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Project created' },
          },
        },
      },
      '/api/projects/{id}': {
        get: {
          summary: 'Get project by id',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Project details' },
            '403': { description: 'Access denied' },
            '404': { description: 'Project not found' },
          },
        },
        put: {
          summary: 'Update project',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    canvasData: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Project updated' },
          },
        },
        delete: {
          summary: 'Delete project',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Project deleted' },
          },
        },
      },
      '/api/projects/{id}/invite': {
        post: {
          summary: 'Invite member',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Member invited' },
          },
        },
      },
      '/api/projects/{id}/members': {
        get: {
          summary: 'List project members',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Members list' },
          },
        },
      },
      '/api/projects/{id}/members/{userId}': {
        delete: {
          summary: 'Remove member',
          tags: ['Projects'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Member removed' },
          },
        },
      },
      '/api/upload/image': {
        post: {
          summary: 'Upload image',
          tags: ['Uploads'],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    image: {
                      type: 'string',
                      format: 'binary',
                    },
                  },
                  required: ['image'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Uploaded' },
            '400': { description: 'No file uploaded' },
          },
        },
      },
    },
  },
  apis: [],
});

export { swaggerSpec, swaggerUi };
