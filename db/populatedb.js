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

// - pizzas_categories_rules: combines pizzas_ingredients with ingredients_categories_rules to link the category rules with the pizzas
//   Columns: DISTINCT pizza_id, category_id, rule_type

// - pizzas_actual_categories: combines pizzas_categories table with pizzas_categories_rules view to get the many-to-many relationships
//   between ingredients and their actual categories (which are the assigned categories united with the enforcing categories from all ingredients,
//   minus the incompatible categories from the same ingredients)
//   Columns: pizza_id, actual_category_id

// - category_rules_per_ingredient: rearranges ingredients_categories_rules table to summarize category rules per ingredient.
//   Columns: ingredient_id, enforced_categories_ids, incompatible_categories_ids, enforced_categories_names, incompatible_categories_names
//   For each ingredient_id, it generates two distinct arrays:
//   * enforced_categories_ids includes the IDs of categories marked as “enforcing” rules,
//   * incompatible_categories_ids includes those marked as “incompatible.”
//   Null values are removed from both arrays, and categories are ordered by their ID.

// - ingredient_rules_per_category: rearranges ingredients_categories_rules table to summarize ingredient rules per category.
//   Columns: category_id, enforcing_ingredients_ids, incompatible_ingredients_ids, enforcing_ingredients_names, incompatible_ingredients_names

// - ingredients_per_pizza: rearranges pizzas_ingredients table to summarize ingredients per pizza.
//   Columns: pizza_id, ingredients_ids, ingredients_names, ingredients_stocks, ingredients_prices, availability (maximum availability), ingredients_total_cost (total ingredients cost)

// - pizzas_per_ingredient: rearranges pizzas_ingredients table to summarize pizzas per ingredient.
//   Columns: ingredient_id, pizzas_ids, pizzas_names

// - categories_per_pizza: rearranges pizzas_actual_categories, pizzas_categories, pizzas_categories_rules, categories tables/views to summarize
//   categories per pizza (considering assigned, enforced, incompatible, actual relations, too).
//   Columns: pizza_id, categories_ids, enforced_categories_ids, incompatible_categories_ids, actual_categories_ids,
//   categories_names, enforced_categories_names, incompatible_categories_names, actual_categories_names

// - pizzas_per_category: rearranges pizzas_actual_categories, pizzas_categories, pizzas_categories_rules, pizzas tables/views to summarize
//   pizzas per category (considering assigned, enforced, incompatible, actual relations, too).
//   Columns: category_id, actual_for_pizzas_ids, actual_for_pizzas_names, pizzas_ids, pizzas_names, enforced_in_pizzas_ids, incompatible_with_pizzas_ids, enforced_in_pizzas_names, incompatible_with_pizzas_names

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
  DROP VIEW IF EXISTS category_names_rules_per_ingredient;
  DROP VIEW IF EXISTS ingredient_rules_per_category;
  DROP VIEW IF EXISTS pizzas_per_ingredient;
  DROP VIEW IF EXISTS pizzas_names_per_ingredient;
  DROP VIEW IF EXISTS pizzas_per_category;
  DROP VIEW IF EXISTS pizzas_brief;
  DROP VIEW IF EXISTS ingredients_per_pizza;
  DROP VIEW IF EXISTS ingredients_names_per_pizza;
  DROP VIEW IF EXISTS categories_per_pizza;
  DROP VIEW IF EXISTS categories_names_per_pizza;
  DROP VIEW IF EXISTS pizzas_actual_categories;
  DROP VIEW IF EXISTS pizzas_categories_rules;

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

  CREATE VIEW pizzas_categories_rules AS
  SELECT DISTINCT 
    pizza_id,
    category_id, 
    rule_type
  FROM pizzas_ingredients AS pi
  JOIN ingredients_categories_rules AS ci  -- ignore ingredients with no rules
  ON pi.ingredient_id = ci.ingredient_id;

  CREATE VIEW pizzas_actual_categories AS
  SELECT 
  	pizza_id,
	  category_id AS actual_category_id
  FROM ((
    (
      SELECT pizza_id,
             category_id
      FROM pizzas_categories_rules
      WHERE rule_type = 'enforcing'
    ) UNION (
      SELECT *
      FROM pizzas_categories
    )
  ) EXCEPT (
    SELECT pizza_id,
           category_id
    FROM pizzas_categories_rules
    WHERE rule_type = 'incompatible'
  ));

	CREATE VIEW category_rules_per_ingredient AS
  SELECT
    ingredient_id,
    -- Enforced categories as array of objects
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT('id', category_id, 'name', c.name)
        ORDER BY category_id
      ) FILTER (WHERE rule_type = 'enforcing')
      , '[]'::json)
    AS enforced_categories,
    -- Incompatible categories as array of objects
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT('id', category_id, 'name', c.name)
        ORDER BY category_id
      ) FILTER (WHERE rule_type = 'incompatible')
      , '[]'::json)
    AS incompatible_categories
  FROM ingredients_categories_rules AS ic
  LEFT JOIN categories AS c ON ic.category_id = c.id
  GROUP BY ingredient_id
  ORDER BY ingredient_id;

  CREATE VIEW category_names_rules_per_ingredient AS
  SELECT
    ingredient_id,
    -- Enforced categories as array of objects
    COALESCE(
      JSON_AGG(
        c.name
        ORDER BY category_id
      ) FILTER (WHERE rule_type = 'enforcing')
      , '[]'::json)
    AS enforced_categories,
    -- Incompatible categories as array of objects
    COALESCE(
      JSON_AGG(
        c.name
        ORDER BY category_id
      ) FILTER (WHERE rule_type = 'incompatible')
      , '[]'::json)
    AS incompatible_categories
  FROM ingredients_categories_rules AS ic
  LEFT JOIN categories AS c ON ic.category_id = c.id
  GROUP BY ingredient_id
  ORDER BY ingredient_id;

  CREATE VIEW ingredient_rules_per_category AS
  SELECT 
    category_id,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT('id', ingredient_id, 'name', i.name)
        ORDER BY ingredient_id
      ) FILTER (WHERE rule_type = 'enforcing')
      , '[]'::json)
    AS enforcing_ingredients,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT('id', ingredient_id, 'name', i.name)
        ORDER BY ingredient_id
      ) FILTER (WHERE rule_type = 'incompatible')
      , '[]'::json)
    AS incompatible_ingredients
  FROM ingredients_categories_rules AS ic
  LEFT JOIN ingredients AS i
  ON ic.ingredient_id = i.id
  GROUP BY category_id
  ORDER BY category_id;

  CREATE VIEW ingredients_per_pizza AS
  SELECT 
    pi.pizza_id, 
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', pi.ingredient_id, 
          'name', i.name,
          'price', i.price,
          'stock', i.stock
        ) ORDER BY pi.ingredient_id
      ), '[]'::json)
    AS ingredients,
    SUM(i.price) AS ingredients_total_cost,
    MIN(i.stock) AS availability
  FROM pizzas_ingredients AS pi
  LEFT JOIN ingredients AS i
  ON pi.ingredient_id = i.id
  GROUP BY pizza_id
  ORDER BY pizza_id;

  CREATE VIEW ingredients_names_per_pizza AS
  SELECT 
    pi.pizza_id, 
    COALESCE(
      JSON_AGG(i.name ORDER BY pi.ingredient_id
      ), '[]'::json)
    AS ingredients
  FROM pizzas_ingredients AS pi
  LEFT JOIN ingredients AS i
  ON pi.ingredient_id = i.id
  GROUP BY pizza_id
  ORDER BY pizza_id;

  CREATE VIEW categories_per_pizza AS
  SELECT -- or explicit, using:  COALESCE(pac_c.pizza_id, pc_c.pizza_id, pcr_c.pizza_id) AS pizza_id, ...
    COALESCE(pac_c.pizza_id, pc_c.pizza_id, pcr_c.pizza_id) AS pizza_id,
    COALESCE(actual_categories, '[]'::json) AS actual_categories,
    COALESCE(categories, '[]'::json) AS categories,
    COALESCE(enforced_categories, '[]'::json) AS enforced_categories,
    COALESCE(incompatible_categories, '[]'::json) AS incompatible_categories
  FROM (
    SELECT 
      pizza_id,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', actual_category_id, 'name', c.name)
          ORDER BY actual_category_id
        ), '[]'::json)
      AS actual_categories
    FROM pizzas_actual_categories AS pac
    LEFT JOIN categories AS c
    ON pac.actual_category_id = c.id
    GROUP BY pizza_id
  ) AS pac_c
  FULL JOIN (
    SELECT 
      pizza_id,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', category_id, 'name', c.name)
          ORDER BY category_id
        ), '[]'::json)
      AS categories
    FROM pizzas_categories AS pc
    LEFT JOIN categories AS c
    ON pc.category_id = c.id
    GROUP BY pizza_id
  ) AS pc_c
  USING(pizza_id) -- this is a common column, and is merged
  FULL JOIN (
    SELECT 
      pizza_id,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', category_id, 'name', c.name)
          ORDER BY category_id
        ) FILTER (WHERE rule_type = 'enforcing')
        , '[]'::json)
      AS enforced_categories,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', category_id, 'name', c.name)
          ORDER BY category_id
        ) FILTER (WHERE rule_type = 'incompatible')
        , '[]'::json)
      AS incompatible_categories
      FROM pizzas_categories_rules AS pc
      LEFT JOIN categories AS c
      ON pc.category_id = c.id
      GROUP BY pizza_id
    ) AS pcr_c
  USING(pizza_id) -- or ON pcr_c.pizza_id = COALESCE(pac_c.pizza_id,pc_c.pizza_id)
  ORDER BY pizza_id;

  CREATE VIEW categories_names_per_pizza AS
  SELECT 
    pc.pizza_id, 
    COALESCE(
      JSON_AGG(c.name ORDER BY pc.category_id
      ), '[]'::json)
    AS categories
  FROM pizzas_categories AS pc
  LEFT JOIN categories AS c
  ON pc.category_id = c.id
  GROUP BY pizza_id
  ORDER BY pizza_id;

  CREATE VIEW pizzas_brief AS
  SELECT 
      id,
      name,
      is_protected,
      COALESCE(ingredients,'[]'::json) AS ingredients,
      ingredients_total_cost AS cost,
      availability,
      COALESCE(actual_categories,'[]'::json) AS actual_categories
    FROM pizzas AS p
    LEFT JOIN ingredients_per_pizza AS ip
    ON p.id = ip.pizza_id
    LEFT JOIN categories_per_pizza AS cp
    ON p.id = cp.pizza_id
    ORDER BY p.id; 

  CREATE VIEW pizzas_per_ingredient AS
  SELECT 
    pi.ingredient_id,
    COALESCE(
      JSON_AGG(p.*), '[]'::json)
    AS pizzas
  FROM pizzas_ingredients AS pi
  LEFT JOIN pizzas_brief AS p
  ON pi.pizza_id = p.id
  GROUP BY ingredient_id
  ORDER BY ingredient_id;

  CREATE VIEW pizzas_names_per_ingredient AS
  SELECT 
    pi.ingredient_id,
    COALESCE(
      JSON_AGG(p.name ORDER BY pi.pizza_id), '[]'::json)
    AS pizzas
  FROM pizzas_ingredients AS pi
  LEFT JOIN pizzas AS p
  ON pi.pizza_id = p.id
  GROUP BY ingredient_id
  ORDER BY ingredient_id;

  CREATE VIEW pizzas_per_category AS	
	SELECT
    COALESCE(pac_p.category_id, pc_p.category_id, pcr_c.category_id) AS category_id,
    COALESCE(actual_for_pizzas, '[]'::json) AS actual_for_pizzas,
    COALESCE(pizzas, '[]'::json) AS pizzas,
    COALESCE(enforced_in_pizzas, '[]'::json) AS enforced_in_pizzas,
    COALESCE(incompatible_with_pizzas, '[]'::json) AS incompatible_with_pizzas
  FROM (
    SELECT 
      pac.actual_category_id AS category_id,
      COALESCE(
        JSON_AGG(p.*), '[]'::json)
      AS actual_for_pizzas
    FROM pizzas_actual_categories AS pac
    LEFT JOIN pizzas_brief AS p
    ON pac.pizza_id = p.id
    GROUP BY category_id
  ) AS pac_p
  FULL JOIN (
    SELECT 
      category_id, 
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', p.id, 'name', p.name)
          ORDER BY p.id
        ), '[]'::json)
      AS pizzas
    FROM pizzas_categories AS pc
    LEFT JOIN pizzas AS p
    ON pc.pizza_id = p.id
    GROUP BY category_id
  ) AS pc_p
  USING(category_id)
  FULL JOIN (
    SELECT 
      category_id,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', p.id, 'name', p.name)
          ORDER BY p.id
        ) FILTER (WHERE rule_type = 'enforcing')
        , '[]'::json)
      AS enforced_in_pizzas,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', p.id, 'name', p.name)
          ORDER BY p.id
        ) FILTER (WHERE rule_type = 'incompatible')
        , '[]'::json)
      AS incompatible_with_pizzas
    FROM pizzas_categories_rules AS pc
    LEFT JOIN pizzas AS p
    ON pc.pizza_id = p.id
    GROUP BY category_id
  ) AS pcr_c
  USING(category_id)
  ORDER BY category_id;
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
