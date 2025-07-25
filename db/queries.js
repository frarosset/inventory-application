const pool = require("./pool.js");

exports.create = {};
exports.read = {};
exports.update = {};
exports.delete = {};

const makeTransaction = async (queries) => {
  // This assumes the queries results are not used

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const query of queries) {
      await client.query(query.text, query.data ?? []);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const queryTextGetIdFromName = (table, idAlias, name, isArray) => `
  SELECT id AS ${idAlias} 
  FROM ${table} 
  WHERE name = ${isArray ? `ANY(${name}::text[])` : name}
`;

exports.create.category = async (data) => {
  // Adding a new category to the database means editing more than one table:
  // categories, pizzas_categories, ingredients_categories_rules
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Currently, only the categories table is updated.
  //
  // Sample data:
  // {
  //    "name": "Bianche",
  //    "is_protected": false,
  //    "notes": "Some notes"
  //    "enforcing_ingredients": ["Mozzarella"],
  //    "incompatible_ingredients": ["Pomodoro"],
  //    "pizzas": []
  // }

  const queries = [
    {
      text: "INSERT INTO categories (name,is_protected,notes) VALUES($1,$2,$3);",
      data: [data.name, data.is_protected ?? false, data.notes ?? ""],
    },
  ];

  await makeTransaction(queries);
};

exports.create.ingredient = async (data) => {
  // Adding a new ingredient to the database means editing more than one table:
  // ingredients, pizzas_ingredients, ingredients_categories_rules
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Currently, only the ingredients and ingredients_categories_rules tables are updated.
  //
  // Sample data:
  // {
  //    "name": "Pomodoro",
  //    "is_protected": false,
  //    "notes": "Some notes"
  //    "enforcedCategories": ["Rosse"],
  //    "incompatibleCategories": ["Bianche"],
  //    "price": "0.5",
  //    "stock": "200"
  //    "pizzas": []
  // }

  const queries = [
    {
      text: "INSERT INTO ingredients (name,is_protected,notes,price,stock) VALUES($1,$2,$3,$4,$5);",
      data: [
        data.name,
        data.is_protected ?? false,
        data.notes ?? "",
        data.price,
        data.stock,
      ],
    },
  ];

  if (
    data.enforcedCategories instanceof Array &&
    data.enforcedCategories.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, category_id, 'enforcing'
         FROM ((
            ${queryTextGetIdFromName("ingredients", "ingredient_id", "$1")}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2", true)}
         ))`,
      data: [data.name, data.enforcedCategories],
    });
  }

  if (
    data.incompatibleCategories instanceof Array &&
    data.incompatibleCategories.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, category_id, 'incompatible'
         FROM ((
            ${queryTextGetIdFromName("ingredients", "ingredient_id", "$1")}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2", true)}
         ))`,
      data: [data.name, data.incompatibleCategories],
    });
  }

  await makeTransaction(queries);
};

exports.create.pizza = async (data) => {
  // Adding a new pizza to the database means editing more than one table:
  // pizzas, pizzas_categories, pizzas_ingredients
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Sample data:
  // {
  //    "name": "Margherita",
  //    "ingredients": ["Pomodoro", "Mozzarella", "Basilico", "Olio"],
  //    "categories": ["Classiche", "Vegetariane"],
  //    "is_protected": false,
  //    "notes": "Some notes"
  // }

  const queries = [
    {
      text: "INSERT INTO pizzas (name,is_protected,notes) VALUES($1,$2,$3);",
      data: [data.name, data.is_protected ?? false, data.notes ?? ""],
    },
  ];

  if (data.categories instanceof Array && data.categories.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT pizza_id, category_id
         FROM ((
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$1")}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2", true)}
         ))`,
      data: [data.name, data.categories],
    });
  }

  if (data.ingredients instanceof Array && data.ingredients.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_ingredients (pizza_id,ingredient_id)
         SELECT pizza_id, ingredient_id
         FROM ((
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$1")}
          ) CROSS JOIN (
            ${queryTextGetIdFromName(
              "ingredients",
              "ingredient_id",
              "$2",
              true
            )}
         ))`,
      data: [data.name, data.ingredients],
    });
  }

  await makeTransaction(queries);
};

// This gets only the essential info for all pizzas in the db
exports.read.pizzasBrief = async () => {
  const { rows } = await pool.query(`
    SELECT *
    FROM pizzas_brief; 
  `);

  return rows;
};

exports.read.pizza = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        p.*,
        COALESCE(ingredients,'[]'::json) AS ingredients,
        ingredients_total_cost AS cost,
        availability,
        COALESCE(actual_categories,'[]'::json) AS actual_categories,    
        COALESCE(categories,'[]'::json) AS categories,
        COALESCE(incompatible_categories,'[]'::json) AS incompatible_categories,
        COALESCE(enforced_categories,'[]'::json) AS enforced_categories
      FROM (
      SELECT * 
        FROM pizzas
        WHERE id=$1
      ) AS p
      LEFT JOIN ingredients_per_pizza AS ip
      ON p.id = ip.pizza_id
      LEFT JOIN categories_per_pizza AS cp
      ON p.id = cp.pizza_id;
    `,
    [id]
  );

  return rows[0];
};

exports.read.ingredientsBrief = async () => {
  const { rows } = await pool.query(`
    SELECT 
      id,
      name,
      is_protected,
      stock,
      price
    FROM ingredients
    ORDER BY id;
  `);

  return rows;
};

exports.read.ingredient = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        i.*,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(enforced_categories,'[]'::json) AS enforced_categories,
        COALESCE(incompatible_categories,'[]'::json) AS incompatible_categories
      FROM (
      SELECT * 
        FROM ingredients
        WHERE id=$1
      ) AS i
      LEFT JOIN pizzas_per_ingredient AS pi
      ON i.id = pi.ingredient_id
      LEFT JOIN category_rules_per_ingredient AS ci
      ON i.id = ci.ingredient_id;
    `,
    [id]
  );

  return rows[0];
};

exports.read.categoriesBrief = async () => {
  const { rows } = await pool.query(`
    SELECT 
      id,
      name,
      is_protected
    FROM categories
    ORDER BY id;
  `);

  return rows;
};

exports.read.category = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        c.*,
        COALESCE(actual_for_pizzas,'[]'::json) AS actual_for_pizzas,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(enforced_in_pizzas,'[]'::json) AS enforced_in_pizzas,
        COALESCE(incompatible_with_pizzas,'[]'::json) AS incompatible_with_pizzas,
        COALESCE(enforcing_ingredients,'[]'::json) AS enforcing_ingredients,
        COALESCE(incompatible_ingredients,'[]'::json) AS incompatible_ingredients
      FROM (
      SELECT * 
        FROM categories
        WHERE id=$1
      ) AS c
      LEFT JOIN pizzas_per_category AS pc
      ON c.id = pc.category_id
      LEFT JOIN ingredient_rules_per_category AS ic
      ON c.id = ic.category_id;
    `,
    [id]
  );

  return rows[0];
};
