const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DATN Backend API',
    version: '1.0.0',
    description: 'API documentation for authentication, users, and class management.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Classes' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Invalid email or password.' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      RegisterBody: {
        type: 'object',
        required: ['role', 'full_name', 'email', 'password'],
        properties: {
          role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
      LoginBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthSuccess: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful.' },
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      Class: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          teacher_id: { type: 'string', format: 'uuid' },
          class_code: { type: 'string', example: 'A1B2C3' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ClassMembership: {
        type: 'object',
        properties: {
          class_id: { type: 'string', format: 'uuid' },
          student_id: { type: 'string', format: 'uuid' },
          permission: { type: 'string', enum: ['Member', 'Owner'] },
          joined_at: { type: 'string', format: 'date-time' },
        },
      },
      ClassMemberDetails: {
        type: 'object',
        properties: {
          user_id: { type: 'string', format: 'uuid' },
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
          permission: { type: 'string', enum: ['Member', 'Owner'] },
          joined_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateClassBody: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
        },
      },
      UpdateClassBody: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
        },
      },
      AddMemberBody: {
        type: 'object',
        required: ['student_id'],
        properties: {
          student_id: { type: 'string', format: 'uuid' },
          permission: { type: 'string', enum: ['Member', 'Owner'], default: 'Member' },
        },
      },
      BulkAddMembersBody: {
        type: 'object',
        required: ['members'],
        properties: {
          members: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['student_id'],
              properties: {
                student_id: { type: 'string', format: 'uuid' },
                permission: { type: 'string', enum: ['Member', 'Owner'], default: 'Member' },
              },
            },
          },
        },
      },
      UpdateMemberRoleBody: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['Member', 'Owner'] },
        },
      },
      JoinClassByCodeBody: {
        type: 'object',
        required: ['class_code'],
        properties: {
          class_code: { type: 'string', example: 'A1B2C3' },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'Duplicate email',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and return JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthSuccess' },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/users/{id}': {
      delete: {
        tags: ['Users'],
        summary: 'Delete user (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/users/search': {
      get: {
        tags: ['Users'],
        summary: 'Search users by full_name (exclude admin and current user)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Keyword used to search by full name',
          },
        ],
        responses: {
          200: {
            description: 'Search result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'query missing',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes': {
      post: {
        tags: ['Classes'],
        summary: 'Create class (teacher only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateClassBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Class created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    class: { $ref: '#/components/schemas/Class' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      get: {
        tags: ['Classes'],
        summary: 'List classes for current user role',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Class list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    classes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Class' },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}': {
      get: {
        tags: ['Classes'],
        summary: 'Fetch class details by id',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Class details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    class: { $ref: '#/components/schemas/Class' },
                    members: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ClassMemberDetails' },
                    },
                    total_members: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      put: {
        tags: ['Classes'],
        summary: 'Update class (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateClassBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Class updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    class: { $ref: '#/components/schemas/Class' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class not found or ownership mismatch',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Classes'],
        summary: 'Delete class (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Class deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    class: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class not found or ownership mismatch',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/join': {
      post: {
        tags: ['Classes'],
        summary: 'Join class by class_code (student only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinClassByCodeBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Class joined',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    class: { $ref: '#/components/schemas/Class' },
                    membership: { $ref: '#/components/schemas/ClassMembership' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid class_code',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'Already joined',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}/members': {
      post: {
        tags: ['Classes'],
        summary: 'Add student to class (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddMemberBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Student added',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    membership: { $ref: '#/components/schemas/ClassMembership' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class or student not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'Already a member',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}/members/bulk': {
      post: {
        tags: ['Classes'],
        summary: 'Add multiple students with permission (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkAddMembersBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Members added',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    members: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ClassMembership' },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class not found or ownership mismatch',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}/members/{userId}/role': {
      patch: {
        tags: ['Classes'],
        summary: 'Update member role in class (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateMemberRoleBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Member role updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    membership: { $ref: '#/components/schemas/ClassMembership' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class or member not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}/members/{userId}': {
      delete: {
        tags: ['Classes'],
        summary: 'Remove member from class (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Member removed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    membership: {
                      type: 'object',
                      properties: {
                        class_id: { type: 'string', format: 'uuid' },
                        student_id: { type: 'string', format: 'uuid' },
                        permission: { type: 'string', enum: ['Member', 'Owner'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Class or member not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
  },
};

module.exports = openapiSpec;
