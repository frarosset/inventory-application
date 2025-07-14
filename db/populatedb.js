#! /usr/bin/env node

require("dotenv").config();
const { Client } = require("pg");
const datadb = require("./datadb.json");
const queries = require("./queries.js");

// Initialize core tables for pizza database schema:

// - pizzas: stores pizza names, notes and their metadata

// - categories: stores classification labels for pizzas, with notes and their metadata

// - ingredients: stores ingredients, with price, stock, notes and their metadata

// - ingredients_categories_rules: many-to-many relation between
//   ingredients and categories. The type of relationship is specified by
//   rule_type field and and can be: "incompatible" or "enforcing" (ie,
//   ingredient enforces a category when present, and when such category is
//   not incompatible by some other ingredient)

// - pizzas_categories: many-to-many relation between pizzas and their
//   assigned categories

// - pizzas_ingredients: many-to-many relation between pizzas and their
//   ingredient

// Some views are created, too, to simplify querying:

// - category_rules_per_ingredient: rearranges ingredients_categories_rules table to summarize category rules per ingredient.
//   Columns: ingredient_id, enforced_categories_ids, incompatible_categories_ids
//   For each ingredient_id, it generates two distinct arrays:
//   * enforced_categories_ids includes the IDs of categories marked as “enforcing” rules,
//   * incompatible_categories_ids includes those marked as “incompatible.”
//   Null values are removed from both arrays, and categories are ordered by their ID.

// - ingredient_rules_per_category: rearranges ingredients_categories_rules table to summarize ingredient rules per category.
//   Columns: category_id, enforcing_ingredients_ids, incompatible_ingredients_ids

const defaultColumns = `
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name VARCHAR(${Number(process.env.NAME_MAX_LENGTH)}) UNIQUE NOT NULL,
        is_protected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT NULL,
        notes VARCHAR(${Number(process.env.NOTES_MAX_LENGTH)})`;

const createForeignKeyColumn = (id, tab, tabId = "id") => `
        ${id} INTEGER NOT NULL,
        FOREIGN KEY (${id}) REFERENCES ${tab}(${tabId})`;

const SQL_drop = `
    DROP VIEW IF EXISTS category_rules_per_ingredient;
    DROP VIEW IF EXISTS ingredient_rules_per_category;
    
    DROP TABLE IF EXISTS pizzas_categories;
    DROP TABLE IF EXISTS pizzas_ingredients;
    DROP TABLE IF EXISTS ingredients_categories_rules;
    DROP TABLE IF EXISTS pizzas;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS ingredients;
`;

const SQL_create = `
    CREATE TABLE IF NOT EXISTS pizzas(
        ${defaultColumns}
    );

    CREATE TABLE IF NOT EXISTS categories(
        ${defaultColumns}
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        ${defaultColumns},
        price NUMERIC NOT NULL DEFAULT 1,
        stock INTEGER NOT NULL DEFAULT 100
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

	CREATE VIEW category_rules_per_ingredient AS
	SELECT 
	  ingredient_id, 
	  array_remove(
		ARRAY_AGG(
		  CASE WHEN rule_type = 'enforcing' THEN category_id END 
		  ORDER BY category_id
		), NULL
	  ) AS enforced_categories_ids, 
	  array_remove(
		ARRAY_AGG(
		  CASE WHEN rule_type = 'incompatible' THEN category_id END 
		  ORDER BY category_id
		), NULL
	  ) AS incompatible_categories_ids 
	FROM ingredients_categories_rules
	GROUP BY ingredient_id;

    CREATE VIEW ingredient_rules_per_category AS
    SELECT 
      category_id, 
      array_remove(
        ARRAY_AGG(
          CASE WHEN rule_type = 'enforcing' THEN ingredient_id END 
          ORDER BY ingredient_id
        ), NULL
      ) AS enforcing_ingredients_ids, 
      array_remove(
        ARRAY_AGG(
          CASE WHEN rule_type = 'incompatible' THEN ingredient_id END 
          ORDER BY ingredient_id
        ), NULL
      ) AS incompatible_ingredients_ids 
    FROM ingredients_categories_rules
    GROUP BY category_id;
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
