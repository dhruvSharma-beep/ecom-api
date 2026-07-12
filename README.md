# ecom-api

RESTful API for the e-commerce platform. Built with Node.js, Express and PostgreSQL.

## Endpoints
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT
- `GET  /api/products` — list products (pagination + search)
- `POST /api/products` — create product (manager/admin)
- `GET  /api/orders` — user's orders
- `POST /api/orders` — place order

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```
