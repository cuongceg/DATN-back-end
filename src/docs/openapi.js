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
    { name: 'Sessions' },
    { name: 'Posts' },
    { name: 'Files' },
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
          status: { type: 'string', enum: ['active', 'archived'] },
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
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          class_id: { type: 'string', format: 'uuid' },
          livekit_room_id: { type: 'string', nullable: true },
          title: { type: 'string' },
          scheduled_at: { type: 'string', format: 'date-time', nullable: true },
          scheduled_end_at: { type: 'string', format: 'date-time', nullable: true },
          start_time: { type: 'string', format: 'date-time', nullable: true },
          end_time: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['scheduled', 'ongoing', 'completed'] },
        },
      },
      CalendarSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          class_id: { type: 'string', format: 'uuid' },
          class_name: { type: 'string' },
          title: { type: 'string' },
          scheduled_at: { type: 'string', format: 'date-time', nullable: true },
          scheduled_end_at: { type: 'string', format: 'date-time', nullable: true },
          start_time: { type: 'string', format: 'date-time', nullable: true },
          end_time: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['scheduled', 'ongoing', 'completed'] },
        },
      },
      CreateSessionBody: {
        type: 'object',
        required: ['classId', 'title'],
        properties: {
          classId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time', nullable: true },
          scheduledEndAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      UpdateSessionBody: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time', nullable: true },
          scheduledEndAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      JoinSessionResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          livekit_url: { type: 'string', example: 'wss://dev-monitor.id.vn' },
          room_name: { type: 'string' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sender_name: { type: 'string' },
          content: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      SessionParticipant: {
        type: 'object',
        properties: {
          user_id: { type: 'string', format: 'uuid' },
          full_name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
          joined_at: { type: 'string', format: 'date-time' },
          left_at: { type: 'string', format: 'date-time', nullable: true },
          is_online: { type: 'boolean' },
        },
      },
      SessionParticipantsResponse: {
        type: 'object',
        properties: {
          session_id: { type: 'string', format: 'uuid' },
          total_count: { type: 'integer' },
          participants: {
            type: 'array',
            items: { $ref: '#/components/schemas/SessionParticipant' },
          },
        },
      },
      LeaveSessionResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Left session successfully.' },
          participant: {
            type: 'object',
            properties: {
              session_id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              joined_at: { type: 'string', format: 'date-time' },
              left_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      SendMessageBody: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          class_id: { type: 'string', format: 'uuid' },
          author_id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['normal', 'session'] },
          title: { type: 'string', nullable: true },
          body_delta: { type: 'object', nullable: true },
          body_plain: { type: 'string', nullable: true },
          session_id: { type: 'string', format: 'uuid', nullable: true },
          author_name: { type: 'string' },
          session_title: { type: 'string', nullable: true },
          session_status: { type: 'string', enum: ['scheduled', 'ongoing', 'completed'], nullable: true },
          session_scheduled_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreatePostBody: {
        type: 'object',
        required: ['classId'],
        properties: {
          classId: { type: 'string', format: 'uuid' },
          title: { type: 'string', maxLength: 500 },
          bodyDelta: { type: 'object' },
          bodyPlain: { type: 'string' },
        },
      },
      UpdatePostBody: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 500 },
          bodyDelta: { type: 'object' },
          bodyPlain: { type: 'string' },
        },
      },
      FolderNode: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          path: { type: 'string', example: '/lecture-notes/slides' },
          name: { type: 'string', example: 'slides' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      FileNode: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          path: { type: 'string', example: '/lecture-notes/chapter1.pdf' },
          original_name: { type: 'string', example: 'chapter1.pdf' },
          mime_type: { type: 'string', nullable: true },
          size_bytes: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ContentItem: {
        type: 'object',
        required: ['id', 'type', 'name', 'path', 'created_at', 'created_by_name'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['folder', 'file'] },
          name: { type: 'string' },
          path: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          created_by_name: { type: 'string' },
          mime_type: { type: 'string', nullable: true },
          size_bytes: { type: 'integer', nullable: true },
        },
      },
      ListContentResponse: {
        type: 'object',
        properties: {
          path: { type: 'string', example: '/lecture-notes/' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContentItem' },
          },
        },
      },
      DownloadUrlResponse: {
        type: 'object',
        properties: {
          download_url: { type: 'string' },
          expires_in_seconds: { type: 'integer', example: 3600 },
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
    '/api/classes/{id}/activate': {
      patch: {
        tags: ['Classes'],
        summary: 'Activate class (teacher owner only)',
        description: "Activate a class (archived → active).",
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
            description: 'Class activated',
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
            description: 'Invalid id',
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
          409: {
            description: 'Invalid class status transition',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/classes/{id}/archive': {
      patch: {
        tags: ['Classes'],
        summary: 'Archive class (teacher owner only)',
        description: "Archive a class (active → archived).",
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
            description: 'Class archived',
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
            description: 'Invalid id',
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
          409: {
            description: 'Invalid class status transition',
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
    '/api/sessions': {
      post: {
        tags: ['Sessions'],
        summary: 'Create session (teacher only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSessionBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Session created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    session: { $ref: '#/components/schemas/Session' },
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
    },
    '/api/sessions/my': {
      get: {
        tags: ['Sessions'],
        summary: 'List my sessions in date range (calendar)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'from',
            required: true,
            schema: { type: 'string', format: 'date-time' },
            description: 'ISO date range start',
          },
          {
            in: 'query',
            name: 'to',
            required: true,
            schema: { type: 'string', format: 'date-time' },
            description: 'ISO date range end',
          },
        ],
        responses: {
          200: {
            description: 'Sessions list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CalendarSession' },
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
        },
      },
    },
    '/api/sessions/class/{classId}': {
      get: {
        tags: ['Sessions'],
        summary: 'List sessions by class',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'classId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Sessions list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Session' },
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
        },
      },
    },
    '/api/sessions/{sessionId}': {
      get: {
        tags: ['Sessions'],
        summary: 'Get session details',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Session details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    session: { $ref: '#/components/schemas/Session' },
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
          404: {
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      patch: {
        tags: ['Sessions'],
        summary: 'Update session schedule/title (teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateSessionBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Session updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    session: { $ref: '#/components/schemas/Session' },
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Sessions'],
        summary: 'Delete session (scheduled only, teacher owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Session deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    session: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Only scheduled sessions can be deleted',
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/sessions/{sessionId}/start': {
      patch: {
        tags: ['Sessions'],
        summary: 'Start session (teacher only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Session started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    session: { $ref: '#/components/schemas/Session' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Unable to start session',
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
    },
    '/api/sessions/{sessionId}/end': {
      patch: {
        tags: ['Sessions'],
        summary: 'End session (teacher only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Session ended',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    session: { $ref: '#/components/schemas/Session' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Unable to end session',
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
    },
    '/api/sessions/{sessionId}/token': {
      post: {
        tags: ['Sessions'],
        summary: 'Join session and get LiveKit token',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Join session success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JoinSessionResponse' },
              },
            },
          },
          400: {
            description: 'Session not started or already ended',
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
            description: 'Session or user not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/sessions/{sessionId}/participants': {
      get: {
        tags: ['Sessions'],
        summary: 'List participants in session',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Participants list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionParticipantsResponse' },
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/sessions/{sessionId}/leave': {
      patch: {
        tags: ['Sessions'],
        summary: 'Leave session',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Leave session success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LeaveSessionResponse' },
              },
            },
          },
          400: {
            description: 'Not joined or already left',
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/sessions/{sessionId}/messages': {
      get: {
        tags: ['Sessions'],
        summary: 'List messages in session',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            in: 'query',
            name: 'limit',
            required: false,
            schema: { type: 'integer', default: 20 },
          },
          {
            in: 'query',
            name: 'offset',
            required: false,
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'Message list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Message' },
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      post: {
        tags: ['Sessions'],
        summary: 'Send message to session',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SendMessageBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Message sent',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    message_data: { $ref: '#/components/schemas/Message' },
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
            description: 'Session not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/posts': {
      post: {
        tags: ['Posts'],
        summary: 'Create normal post',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePostBody' },
            },
          },
        },
        responses: {
          201: {
            description: 'Post created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    post: { $ref: '#/components/schemas/Post' },
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
            description: 'Class not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/posts/class/{classId}': {
      get: {
        tags: ['Posts'],
        summary: 'List posts by class',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'classId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            in: 'query',
            name: 'limit',
            required: false,
            schema: { type: 'integer', default: 20 },
          },
          {
            in: 'query',
            name: 'offset',
            required: false,
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'Posts list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    posts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Post' },
                    },
                    total_count: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
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
            description: 'Class not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/posts/{postId}': {
      get: {
        tags: ['Posts'],
        summary: 'Get post detail',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'postId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Post detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { post: { $ref: '#/components/schemas/Post' } },
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
            description: 'Post not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      patch: {
        tags: ['Posts'],
        summary: 'Update post (author only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'postId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePostBody' },
            },
          },
        },
        responses: {
          200: {
            description: 'Post updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    post: { $ref: '#/components/schemas/Post' },
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
            description: 'Post not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Delete post (author or class teacher)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'postId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Post deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    post: {
                      type: 'object',
                      properties: { id: { type: 'string', format: 'uuid' } },
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
            description: 'Post not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/files/class/{classId}/content': {
      post: {
        tags: ['Files'],
        summary: 'Create folder or upload file by path (teacher only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'classId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'path'],
                properties: {
                  type: { type: 'string', enum: ['folder'], example: 'folder' },
                  path: { type: 'string', example: '/lecture-notes/slides' },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['type', 'path'],
                    properties: {
                      type: { type: 'string', enum: ['folder'], example: 'folder' },
                      path: { type: 'string', example: '/lecture-notes/slides' },
                    },
                  },
                  {
                    type: 'object',
                    required: ['type', 'path', 'file'],
                    properties: {
                      type: { type: 'string', enum: ['file'], example: 'file' },
                      path: { type: 'string', example: '/lecture-notes/chapter1.pdf' },
                      file: { type: 'string', format: 'binary' },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'Folder created successfully.' },
                        folder: { $ref: '#/components/schemas/FolderNode' },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'File uploaded successfully.' },
                        file: { $ref: '#/components/schemas/FileNode' },
                      },
                    },
                  ],
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
            description: 'Class not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'Path already exists',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          413: {
            description: 'File too large',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      get: {
        tags: ['Files'],
        summary: 'List folders and files under a path (non-recursive)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'classId', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            in: 'query',
            name: 'path',
            required: false,
            schema: { type: 'string', example: '/' },
            description: 'Folder path to list. Defaults to /',
          },
        ],
        responses: {
          200: {
            description: 'Content list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ListContentResponse' },
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
            description: 'Path not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Files'],
        summary: 'Delete file or folder by path (creator only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'classId', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            in: 'query',
            name: 'path',
            required: true,
            schema: { type: 'string', example: '/lecture-notes/chapter1.pdf' },
          },
        ],
        responses: {
          200: {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { message: { type: 'string' } } },
              },
            },
          },
          400: {
            description: 'Validation error or folder not empty',
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
            description: 'Path not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'MinIO error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/files/class/{classId}/download': {
      get: {
        tags: ['Files'],
        summary: 'Get presigned download URL by file path',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'classId', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            in: 'query',
            name: 'path',
            required: true,
            schema: { type: 'string', example: '/lecture-notes/chapter1.pdf' },
          },
        ],
        responses: {
          200: {
            description: 'Download URL generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DownloadUrlResponse' },
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
            description: 'File not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'Failed to generate URL',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
  },
};

module.exports = openapiSpec;
