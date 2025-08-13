const pool = require("./pool.js");

exports.create = {};
exports.read = {};
exports.update = {};
exports.delete = {};

const makeTransaction = async (queries) => {
  // This assumes the queries results are not used within the queries
  const results = [];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const query of queries) {
      const res = await client.query(query.text, query.data ?? []);
      results.push(res.rows || []);
    }

    await client.query("COMMIT");

    return results;
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
  // Sample data:
  // {
  //    "name": "Bianche",
  //    "is_protected": false,
  //    "notes": "Some notes"
  //    "enforcingIngredients": ["Mozzarella"],
  //    "incompatibleIngredients": ["Pomodoro"],
  //    "pizzas": []
  // }

  const queries = [
    {
      text: "INSERT INTO categories (name,is_protected,notes) VALUES($1,$2,$3) RETURNING id;",
      data: [data.name, data.is_protected ?? false, data.notes ?? ""],
    },
  ];

  if (
    data.enforcingIngredients instanceof Array &&
    data.enforcingIngredients.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, category_id, 'enforcing'
         FROM ((
            ${queryTextGetIdFromName(
              "ingredients",
              "ingredient_id",
              "$1",
              true
            )}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2")}
         ))`,
      data: [data.enforcingIngredients, data.name],
    });
  }

  if (
    data.incompatibleIngredients instanceof Array &&
    data.incompatibleIngredients.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, category_id, 'incompatible'
         FROM ((
            ${queryTextGetIdFromName(
              "ingredients",
              "ingredient_id",
              "$1",
              true
            )}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2")}
         ))`,
      data: [data.incompatibleIngredients, data.name],
    });
  }

  if (data.pizzas instanceof Array && data.pizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT pizza_id, category_id
         FROM ((
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$1", true)}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("categories", "category_id", "$2")}
         ))`,
      data: [data.pizzas, data.name],
    });
  }

  const results = await makeTransaction(queries);

  return results[0][0].id;
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
      text: "INSERT INTO ingredients (name,is_protected,notes,price,stock) VALUES($1,$2,$3,$4,$5) RETURNING id;",
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

  if (data.pizzas instanceof Array && data.pizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_ingredients (pizza_id,ingredient_id)
         SELECT pizza_id, ingredient_id
         FROM ((
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$1", true)}
          ) CROSS JOIN (
            ${queryTextGetIdFromName("ingredients", "ingredient_id", "$2")}
         ))`,
      data: [data.pizzas, data.name],
    });
  }

  const results = await makeTransaction(queries);

  return results[0][0].id;
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
      text: "INSERT INTO pizzas (name,is_protected,notes) VALUES($1,$2,$3) RETURNING id;",
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

  const results = await makeTransaction(queries);

  return results[0][0].id;
};

// This gets only the essential info for all pizzas in the db
exports.read.pizzasBrief = async () => {
  const { rows } = await pool.query(`
    SELECT *
    FROM pizzas_brief; 
  `);

  return rows;
};

exports.read.pizzasNames = async () => {
  const { rows } = await pool.query(`
    SELECT 
      name,
      is_protected
    FROM pizzas
    ORDER BY id;
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

// This gets only the essential info for edit a pizza
exports.read.pizzaEdit = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        p.*,
        COALESCE(ingredients,'[]'::json) AS ingredients,    
        COALESCE(categories,'[]'::json) AS categories
      FROM (
      SELECT * 
        FROM pizzas
        WHERE id=$1
      ) AS p
      LEFT JOIN ingredients_names_per_pizza AS ip
      ON p.id = ip.pizza_id
      LEFT JOIN categories_names_per_pizza AS cp
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

exports.read.ingredientsNames = async () => {
  const { rows } = await pool.query(`
    SELECT 
      name
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

// This gets only the essential info for edit an ingredient
exports.read.ingredientEdit = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        i.*,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(enforced_categories,'[]'::json) AS "enforcedCategories",
        COALESCE(incompatible_categories,'[]'::json) AS "incompatibleCategories"
      FROM (
      SELECT * 
        FROM ingredients
        WHERE id=$1
      ) AS i
      LEFT JOIN pizzas_names_per_ingredient AS pi
      ON i.id = pi.ingredient_id
      LEFT JOIN category_names_rules_per_ingredient AS ci
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

exports.read.categoriesNames = async () => {
  const { rows } = await pool.query(`
    SELECT 
      name
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

// This gets only the essential info for edit an category
exports.read.categoryEdit = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        c.*,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(enforcing_ingredients,'[]'::json) AS "enforcingIngredients",
        COALESCE(incompatible_ingredients,'[]'::json) AS "incompatibleIngredients"
      FROM (
      SELECT * 
        FROM categories
        WHERE id=$1
      ) AS c
      LEFT JOIN pizzas_names_per_category AS pc
      ON c.id = pc.category_id
      LEFT JOIN ingredient_names_rules_per_category AS ic
      ON c.id = ic.category_id;
    `,
    [id]
  );

  return rows[0];
};
