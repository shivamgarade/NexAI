import { z } from 'zod';
import { generateContent } from '../services/gemini.service.js';
import { SCHEMA_SYSTEM_PROMPT } from './prompts/schema.prompt.js';
import { logger } from '../utils/logger.js';

const fieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  isPrimary: z.boolean().optional().default(false),
  isRequired: z.boolean().optional().default(false),
  isUnique: z.boolean().optional().default(false),
  isForeignKey: z.boolean().optional().default(false),
  references: z.string().optional(),
  description: z.string().optional(),
});

const entitySchema = z.object({
  name: z.string(),
  description: z.string().optional().default(''),
  fields: z.array(fieldSchema).default([]),
});

const schemaResultSchema = z.object({
  title: z.string().default('Generated Schema Architecture'),
  summary: z.string().default('Entity-relationship model and multi-dialect schema definition.'),
  entities: z.array(entitySchema).default([]),
  mermaidErDiagram: z.string().default(''),
  codeOutputs: z.object({
    mongoose: z.string().optional().default(''),
    sql: z.string().optional().default(''),
    prisma: z.string().optional().default(''),
    typescript: z.string().optional().default(''),
  }).default({}),
  designNotes: z.array(z.string()).optional().default([]),
});

/**
 * Strips markdown code fences (```json ... ```) and parses the JSON.
 *
 * @param {string} text
 * @returns {any}
 */
function parseJsonOutput(text) {
  let cleaned = (text || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Generates an offline simulated model for offline development or testing.
 *
 * @param {string} prompt
 * @returns {any}
 */
function getSimulatedSchema(prompt) {
  const isEcommerce = /e-?commerce|shop|cart|product|order/i.test(prompt);

  if (isEcommerce) {
    return {
      title: 'E-Commerce Platform Data Model',
      summary: 'Production-ready normalized database schema with User, Product, Order, and OrderItem entities with foreign key constraints and compound indexing.',
      entities: [
        {
          name: 'User',
          description: 'Platform user account with authentication and contact information.',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
            { name: 'email', type: 'VARCHAR(255)', isPrimary: false, isRequired: true, isUnique: true },
            { name: 'passwordHash', type: 'VARCHAR(255)', isPrimary: false, isRequired: true },
            { name: 'role', type: 'VARCHAR(50)', isPrimary: false, isRequired: true },
            { name: 'createdAt', type: 'TIMESTAMP', isPrimary: false, isRequired: true },
          ],
        },
        {
          name: 'Product',
          description: 'Catalog product with stock inventory and pricing.',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
            { name: 'sku', type: 'VARCHAR(64)', isPrimary: false, isRequired: true, isUnique: true },
            { name: 'title', type: 'VARCHAR(255)', isPrimary: false, isRequired: true },
            { name: 'priceCents', type: 'INTEGER', isPrimary: false, isRequired: true },
            { name: 'stockQuantity', type: 'INTEGER', isPrimary: false, isRequired: true },
          ],
        },
        {
          name: 'Order',
          description: 'Customer purchase transaction with payment and fulfillment status.',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
            { name: 'userId', type: 'UUID', isPrimary: false, isRequired: true, isForeignKey: true, references: 'User.id' },
            { name: 'status', type: 'VARCHAR(32)', isPrimary: false, isRequired: true },
            { name: 'totalAmountCents', type: 'INTEGER', isPrimary: false, isRequired: true },
            { name: 'createdAt', type: 'TIMESTAMP', isPrimary: false, isRequired: true },
          ],
        },
        {
          name: 'OrderItem',
          description: 'Individual line item associated with an order.',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
            { name: 'orderId', type: 'UUID', isPrimary: false, isRequired: true, isForeignKey: true, references: 'Order.id' },
            { name: 'productId', type: 'UUID', isPrimary: false, isRequired: true, isForeignKey: true, references: 'Product.id' },
            { name: 'unitPriceCents', type: 'INTEGER', isPrimary: false, isRequired: true },
            { name: 'quantity', type: 'INTEGER', isPrimary: false, isRequired: true },
          ],
        },
      ],
      mermaidErDiagram: `erDiagram
    USER ||--o{ ORDER : "places"
    ORDER ||--|{ ORDER_ITEM : "contains"
    PRODUCT ||--o{ ORDER_ITEM : "ordered_in"

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string role
        timestamp createdAt
    }

    PRODUCT {
        uuid id PK
        string sku UK
        string title
        int priceCents
        int stockQuantity
    }

    ORDER {
        uuid id PK
        uuid userId FK
        string status
        int totalAmountCents
        timestamp createdAt
    }

    ORDER_ITEM {
        uuid id PK
        uuid orderId FK
        uuid productId FK
        int unitPriceCents
        int quantity
    }`,
      codeOutputs: {
        mongoose: `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  priceCents: { type: Number, required: true, min: 0 },
  stockQuantity: { type: Number, required: true, default: 0 }
}, { timestamps: true });

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  unitPriceCents: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'paid', 'fulfilled', 'cancelled'], default: 'pending', index: true },
  items: [orderItemSchema],
  totalAmountCents: { type: Number, required: true }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Product = mongoose.model('Product', productSchema);
export const Order = mongoose.model('Order', orderSchema);`,
        sql: `-- PostgreSQL DDL with Indexes and Constraints
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);`,
        prisma: `// Prisma Schema Definition
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         String   @default("customer")
  orders       Order[]
  createdAt    DateTime @default(now())
}

model Product {
  id            String      @id @default(uuid())
  sku           String      @unique
  title         String
  priceCents    Int
  stockQuantity Int         @default(0)
  orderItems    OrderItem[]
  createdAt     DateTime    @default(now())
}

model Order {
  id               String      @id @default(uuid())
  userId           String
  user             User        @relation(fields: [userId], references: [id])
  status           String      @default("pending")
  totalAmountCents Int
  items            OrderItem[]
  createdAt        DateTime    @default(now())

  @@index([userId])
}

model OrderItem {
  id             String  @id @default(uuid())
  orderId        String
  order          Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId      String
  product        Product @relation(fields: [productId], references: [id])
  unitPriceCents Int
  quantity       Int

  @@index([orderId])
}`,
        typescript: `// TypeScript Entity Interfaces & DTOs
export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  role: 'customer' | 'admin';
  createdAt: Date;
}

export interface ProductEntity {
  id: string;
  sku: string;
  title: string;
  priceCents: number;
  stockQuantity: number;
}

export interface OrderItemEntity {
  id: string;
  orderId: string;
  productId: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderEntity {
  id: string;
  userId: string;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
  totalAmountCents: number;
  items?: OrderItemEntity[];
  createdAt: Date;
}`,
      },
      designNotes: [
        'Used UUIDv4 for distributed primary keys to prevent enumeration attacks.',
        'Denormalized unitPriceCents into order_items to capture historical purchase price.',
        'Postgres foreign keys enforce ON DELETE RESTRICT on products to preserve audit integrity.',
      ],
    };
  }

  // Generic SaaS/App fallback
  return {
    title: 'Application Domain Model',
    summary: 'Core relational architecture with Organization, User, Project, and AuditLog tables.',
    entities: [
      {
        name: 'Organization',
        description: 'Multi-tenant root container for teams and enterprise workspaces.',
        fields: [
          { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
          { name: 'name', type: 'VARCHAR(100)', isPrimary: false, isRequired: true },
          { name: 'slug', type: 'VARCHAR(64)', isPrimary: false, isRequired: true, isUnique: true },
          { name: 'createdAt', type: 'TIMESTAMP', isPrimary: false, isRequired: true },
        ],
      },
      {
        name: 'User',
        description: 'Member account belonging to an organization.',
        fields: [
          { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
          { name: 'orgId', type: 'UUID', isPrimary: false, isRequired: true, isForeignKey: true, references: 'Organization.id' },
          { name: 'email', type: 'VARCHAR(255)', isPrimary: false, isRequired: true, isUnique: true },
          { name: 'role', type: 'VARCHAR(32)', isPrimary: false, isRequired: true },
        ],
      },
      {
        name: 'Project',
        description: 'Collaborative workspace container for resources and tasks.',
        fields: [
          { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
          { name: 'orgId', type: 'UUID', isPrimary: false, isRequired: true, isForeignKey: true, references: 'Organization.id' },
          { name: 'title', type: 'VARCHAR(200)', isPrimary: false, isRequired: true },
          { name: 'status', type: 'VARCHAR(32)', isPrimary: false, isRequired: true },
        ],
      },
    ],
    mermaidErDiagram: `erDiagram
    ORGANIZATION ||--|{ USER : "employs"
    ORGANIZATION ||--o{ PROJECT : "owns"

    ORGANIZATION {
        uuid id PK
        string name
        string slug UK
        timestamp createdAt
    }

    USER {
        uuid id PK
        uuid orgId FK
        string email UK
        string role
    }

    PROJECT {
        uuid id PK
        uuid orgId FK
        string title
        string status
    }`,
    codeOutputs: {
      mongoose: `import mongoose from 'mongoose';

const orgSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' }
}, { timestamps: true });

export const Organization = mongoose.model('Organization', orgSchema);
export const User = mongoose.model('User', userSchema);`,
      sql: `-- Multi-Tenant PostgreSQL DDL
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'member'
);

CREATE INDEX idx_users_org_id ON users(org_id);`,
      prisma: `model Organization {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  users     User[]
  createdAt DateTime @default(now())
}

model User {
  id     String       @id @default(uuid())
  orgId  String
  org    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  email  String       @unique
  role   String       @default("member")

  @@index([orgId])
}`,
      typescript: `export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface UserEntity {
  id: string;
  orgId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}`,
    },
    designNotes: [
      'Multi-tenant partition key (orgId) applied across all child tables for data isolation.',
      'Unique compound index on organizational slugs enables clean subdomains or route prefixes.',
    ],
  };
}

/**
 * Generates structured database schemas & ERD diagrams via Gemini Flash.
 *
 * @param {Object} params
 * @param {string} params.prompt - Description of system requirements
 * @param {string[]} [params.dialects] - Code dialects to output
 * @param {string} [params.existingSchema] - Previous schema context to evolve
 * @param {'flash' | 'pro'} [params.model='flash']
 * @param {boolean} [params.isSimulation=false]
 * @returns {Promise<{ schema: any, tokensUsed: number }>}
 */
export async function generateDatabaseSchema({
  prompt,
  dialects = ['mongoose', 'sql', 'prisma', 'typescript'],
  existingSchema = '',
  model = 'flash',
  isSimulation = false,
}) {
  if (isSimulation) {
    return {
      schema: getSimulatedSchema(prompt),
      tokensUsed: 0,
    };
  }

  const userMessage = [
    `Domain Requirements:`,
    prompt,
    existingSchema ? `\nExisting Schema Context (refactor or extend this):\n${existingSchema}` : '',
    `\nRequested Dialects: ${dialects.join(', ')}`,
  ].filter(Boolean).join('\n');

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      model,
      systemInstruction: SCHEMA_SYSTEM_PROMPT,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = parseJsonOutput(result.text);
    const validated = schemaResultSchema.parse(parsed);

    // Clean up mermaid diagram if needed
    let mermaid = (validated.mermaidErDiagram || '').trim();
    if (mermaid.startsWith('```')) {
      mermaid = mermaid
        .replace(/^```(?:mermaid)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }
    if (!mermaid.startsWith('erDiagram')) {
      mermaid = `erDiagram\n${mermaid}`;
    }
    validated.mermaidErDiagram = mermaid;

    return {
      schema: validated,
      tokensUsed: result.totalTokens || 0,
    };
  } catch (err) {
    logger.warn(
      { error: err.message },
      'Gemini schema generation failed or returned invalid JSON; falling back to domain template',
    );
    return {
      schema: getSimulatedSchema(prompt),
      tokensUsed: 0,
    };
  }
}
