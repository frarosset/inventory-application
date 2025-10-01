# inventory-application

A pizza inventory application is built using HTML, CSS, and JavaScript.

A Node.js + Express server renders views with EJS and handles pizzas, ingredients, doughs and categories information storage using PostgreSQL.

> 🔗 A preview is available [here](https://inventory-application-kefq.onrender.com)

## Features
- Persistent data storage of pizzas, ingredients, categories, doughs, and their relationships using a PostgreSQL database.
- Many-to-many relationships between entities modeled as one-to-many entities.
- Full CRUD operations for pizzas, ingredients, categories, doughs, and their relationships.
- Query simplification through PostgreSQL views (virtual tables).
- Input validation using [`express-validator`](https://express-validator.github.io/).
- Safe database updates using PostgreSQL transactions.
- Stock management for ingredients and doughs.
- Pizza categorization by user-defined categories and ingredient-dependant categories.
- Mutation protection for any entity marked as protected, enforced via admin password.
- Search functionality across pizzas, categories, ingredients and doughs.
- Timestamps formatted client-side based on user timezone
- Responsive UI

## Inventory Description
This inventory system handles pizzas, ingredients, doughs and categories information, and the relationships between them.

- Each ingredient and dough has a price and a stock count (a stock unit is to be interpreted as *an unit per pizza*).
- Each ingredient can enforce categories or make them incompatible for the pizza in which they are used (e.g., *Tomato* enforces category *Red Pizzas*, but is incompatible with category *White Pizzas*).
- Each pizza has a list of ingredients and a list of user-defined categories.
  - The actual cateogries of a pizza are computed as the union of its user-defined categories and those enforced by its ingredients, excluding any that is incompatible with them.
  - The price of a pizza is the sum of the cost of each ingredient used, plus that of the chosen dough.
  - The availability of each pizza is the minimum stock among that of the used ingredients, and that of the chosen dough.

### Stock management

- Pizzas can be ordered with a chosen dough: this decrements the stock of the used ingredients and dough by the pizzas ordered amount.
- Ingredients and doughs can be restocked: this increments their stock count by the specified amount.

### Mutation Protection

The database is initialized with some seeded pizzas, ingredients, categories and doughs, which are protected: an admin password is required to edit or delete them.

However, users can freely create their own pizzas, ingredients, categories, doughs — and fully manage them afterward. To mark them as protected, the admin password must be provided.

- **Pizza–Category / Pizza–Ingredient relationships**: If the pizza is protected, the admin password is required to edit its relationships. Otherwise, users may associate it with any ingredients or categories, including protected ones.
- **Category–Ingredient rules (enforced/incompatible)**: These are freely editable if at least one of the category or the ingredient is not protected. If both are protected, the admin password is required. This prevents users from modifying rules seeded at initialization.

## Database Schema

The database schema includes tables for pizzas, ingredients, doughs, categories, and their relationships. Many-to-many relationships are modeled as one-to-many ones.

The diagram below was generated from a **.dbml** file derived from the PostgreSQL **.sql** schema. It visualizes the core tables and their connections:

![database diagram](https://raw.githubusercontent.com/frarosset/inventory-application/refs/heads/main/db/schema-inventory-application.png)

> [!NOTE]  
> A pizza's **price**, **stock** and **actual categories** are computed dynamically from the underlying table data.

> [!NOTE]  
> The diagram does **not** include the database **views** (e.g., `category_rules_per_ingredient`, `pizzas_per_category`, `pizzas_actual_categories`, and so on), which have been introduced to simplify the queries.

## Tech Stack

- **Node.js** – JavaScript runtime for the server
- **Express** – Web framework for routing and server logic
- **EJS** – Embedded JavaScript templating for HTML rendering
- **PostgreSQL** – Relational database for persistent message storage
- **pg** – Node.js client for PostgreSQL
- **express-validator** – Input validation middleware
- **express-async-handler** – Simplifies async route handlers
- **dotenv** – Loads environment variables from `.env` files
- **Vanilla JavaScript / HTML / CSS** – Frontend logic and layout
- [**DoodleCSS**](https://chr15m.github.io/DoodleCSS) – Hand-drawn HTML/CSS theme

## Setup

Follow these steps to run the app locally:

1. **Clone the repository**
   ```bash
   git clone git@github.com:frarosset/inventory-application.git
   cd inventory-application
   ```
2. **Install dependencies**
   ```bash
    npm install
   ```
3. **Initialize the database**
   
   Initialize a PostgreSQL database and obtain its connection URI
   ```
   postgresql://your_user:your_password@host:port/your_db
   ```
5. **Configure environment variables**
   
   Create a `.env` file in the root directory (use `.env.example` as a reference)
   
7. **Start the server**
   ```bash
    node app.js
   ```
