#! /usr/bin/env node

require("dotenv").config();
const { Client } = require("pg");
const datadb = require("./datadb.json");
const queries = require("./queries.js");

// Initialize core tables for pizza database schema:

// - pizzas: stores pizza names, notes and their metadata

// - categories: stores classification labels for pizzas and their metadata

// - ingredients: stores ingredients, with price, stock and their metadata

// - ingredients_enforced_categories: many-to-many relation between
//   ingredients and the categories they enforce when present (and when
//   such categories are not incompatible by some other ingredient)

// - ingredients_incompatible_categories:  many-to-many relation between
//   ingredients and the incompatible categories

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
    DROP TABLE IF EXISTS ingredients_enforced_categories;
    DROP TABLE IF EXISTS ingredients_incompatible_categories;
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
        ${createForeignKeyColumn("category_id", "categories")}
    );

    CREATE TABLE IF NOT EXISTS pizzas_ingredients (
        ${createForeignKeyColumn("pizza_id", "pizzas")},
        ${createForeignKeyColumn("ingredient_id", "ingredients")}
    );

    CREATE TABLE IF NOT EXISTS ingredients_enforced_categories (
        ${createForeignKeyColumn("ingredient_id", "ingredients")},
        ${createForeignKeyColumn("category_id", "categories")}
    );

    CREATE TABLE IF NOT EXISTS ingredients_incompatible_categories (
        ${createForeignKeyColumn("ingredient_id", "ingredients")},
        ${createForeignKeyColumn("category_id", "categories")}
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

  // add pizzas to the db
  for (const pizza of datadb.pizzas) {
    await queries.create.pizza({
      ...pizza,
      is_protected: true,
    });
  }
}

main();
