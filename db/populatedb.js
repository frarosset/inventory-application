#! /usr/bin/env node

require("dotenv").config();
const { Client } = require("pg");
const datadb = require("./datadb.json");
const queries = require("./queries.js");

// Initialize core tables for pizza database schema:

// - pizzas: stores pizza names, notes and their metadata

// - categories: stores classification labels for pizzas and their metadata

// - ingredients: stores ingredients, with price, stock and their metadata

// - ingredients_categories_rules: many-to-many relation between
//   ingredients and categories. The type of relationship is specified by
//   rule_type field and and can be: "incompatible" or "enforcing" (ie,
//   ingredient enforces a category when present, and when such category is
//   not incompatible by some other ingredient)

// - pizzas_categories: many-to-many relation between pizzas and their
//   assigned categories

// - pizzas_ingredients: many-to-many relation between pizzas and their
//   ingredient

const defaultColumns = `
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name VARCHAR(${Number(process.env.NAME_MAX_LENGTH)}) UNIQUE NOT NULL,
        is_protected BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT NULL`;

const createForeignKeyColumn = (id, tab, tabId = "id") => `
        ${id} INTEGER,
        FOREIGN KEY (${id}) REFERENCES ${tab}(${tabId})`;

const SQL_drop = `
    DROP TABLE IF EXISTS pizzas_categories;
    DROP TABLE IF EXISTS pizzas_ingredients;
    DROP TABLE IF EXISTS ingredients_categories_rules;
    DROP TABLE IF EXISTS pizzas;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS ingredients;
`;

const SQL_create = `
    CREATE TABLE IF NOT EXISTS pizzas(
        ${defaultColumns},
        notes VARCHAR(${Number(process.env.NOTES_MAX_LENGTH)})
    );

    CREATE TABLE IF NOT EXISTS categories(
        ${defaultColumns}
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        ${defaultColumns},
        price NUMERIC DEFAULT 1,
        stock INTEGER DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS pizzas_categories (
        ${createForeignKeyColumn("pizza_id", "pizzas")},
        ${createForeignKeyColumn("category_id", "categories")},
        CONSTRAINT U_pizza_category UNIQUE (pizza_id,category_id)
    );

    CREATE TABLE IF NOT EXISTS pizzas_ingredients (
        ${createForeignKeyColumn("pizza_id", "pizzas")},
        ${createForeignKeyColumn("ingredient_id", "ingredients")},
        CONSTRAINT U_pizza_ingredient UNIQUE (pizza_id, ingredient_id)
    );

    CREATE TABLE IF NOT EXISTS ingredients_categories_rules (
        ${createForeignKeyColumn("ingredient_id", "ingredients")},
        ${createForeignKeyColumn("category_id", "categories")},
        rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('enforcing', 'incompatible')),
        CONSTRAINT U_ingredient_category UNIQUE (ingredient_id,category_id)
    );
`;

const SQL_init = SQL_drop + SQL_create;

const connectionString =
  process.argv.length > 2 ? process.argv[2] : process.env.DB_CONNECTION_STRING;

async function main() {
  const client = new Client({ connectionString });

  await client.connect();
  await client.query(SQL_init);
  await client.end();

  // add categories to the db
  for (const category of datadb.categories) {
    await queries.create.category({
      ...category,
      is_protected: true,
    });
  }

  // add ingredients to the db
  for (const ingredient of datadb.ingredients) {
    await queries.create.ingredient({
      ...ingredient,
      is_protected: true,
    });
  }

  // add pizzas to the db
  for (const pizza of datadb.pizzas) {
    await queries.create.pizza({
      ...pizza,
      is_protected: true,
    });
  }
}

main();
