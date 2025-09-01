const pool = require("./pool.js");

exports.create = {};
exports.read = {};
exports.update = {};
exports.delete = {};

const makeTransaction = async (
  queries,
  beforeCommitCallback = async () => {}
) => {
  // This assumes the queries results are not used within the queries
  const results = [];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const query of queries) {
      const res = await client.query(query.text, query.data ?? []);
      results.push(res.rows || []);
    }

    const beforeCommitCallbackResult = await beforeCommitCallback(
      client,
      results
    );
    results.push(beforeCommitCallbackResult);

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

  // Setting a pizza's ingredients / categories just count as an operation to the pizza,
  // but not to the ingredients / categories

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

    queries.push({
      text: `
        UPDATE ingredients 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.enforcingIngredients],
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

    queries.push({
      text: `
        UPDATE ingredients 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.incompatibleIngredients],
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

    queries.push({
      text: `
        UPDATE pizzas 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.pizzas],
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

  // Setting a pizza's ingredients / categories just count as an operation to the pizza,
  // but not to the ingredients / categories
  // Setting a ingredient - category rule, count as an operation of both

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

    queries.push({
      text: `
        UPDATE categories 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.enforcedCategories],
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

    queries.push({
      text: `
        UPDATE categories 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.incompatibleCategories],
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

    queries.push({
      text: `
        UPDATE pizzas
        SET updated_at = CURRENT_TIMESTAMP
        WHERE name = ANY($1::text[]);`,
      data: [data.pizzas],
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

  // Setting a pizza's ingredients / categories just count as an operation to the pizza,
  // but not to the ingredients / categories

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

exports.update.pizza = async (data) => {
  const queries = [
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas_categories WHERE pizza_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas_ingredients WHERE pizza_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      text: `UPDATE pizzas 
             SET name = $1, 
             is_protected = $2,
             notes = $3
             WHERE id = $4 
             AND (name IS DISTINCT FROM $1 OR 
             is_protected IS DISTINCT FROM $2 OR
             notes IS DISTINCT FROM $3) 
             RETURNING id;`,
      data: [data.name, data.is_protected ?? false, data.notes ?? "", data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM pizzas_categories
         WHERE pizza_id = $1
         RETURNING category_id;`,
      data: [data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM pizzas_ingredients
         WHERE pizza_id = $1
         RETURNING ingredient_id;`,
      data: [data.id],
    },
  ];

  let nextIdx = queries.length;
  const idxCreated = {};

  if (data.categories instanceof Array && data.categories.length > 0) {
    queries.push({
      text: `
         -- Insert new links
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT $1, category_id
         FROM (${queryTextGetIdFromName(
           "categories",
           "category_id",
           "$2",
           true
         )})
         RETURNING category_id;`,
      data: [data.id, data.categories],
    });
    idxCreated.categories = nextIdx++;
  }

  if (data.ingredients instanceof Array && data.ingredients.length > 0) {
    queries.push({
      text: `
         -- Insert new links
         INSERT INTO pizzas_ingredients (pizza_id,ingredient_id)
         SELECT $1, ingredient_id
         FROM (${queryTextGetIdFromName(
           "ingredients",
           "ingredient_id",
           "$2",
           true
         )})
         RETURNING ingredient_id;`,
      data: [data.id, data.ingredients],
    });
    idxCreated.ingredients = nextIdx++;
  }

  async function beforeCommitCallback(client, results) {
    const updatedPizza = results[3]?.[0]?.id;
    const updatedCategories = updatedItems(
      results,
      4,
      idxCreated.categories,
      "category_id"
    );
    const updatedIngredients = updatedItems(
      results,
      5,
      idxCreated.ingredients,
      "ingredient_id"
    );

    // updating a pizza's ingredients / categories just count as an update to the pizza,
    // but not to the ingredients / categories
    const wasUpdated =
      updatedPizza != null ||
      updatedCategories.length > 0 ||
      updatedIngredients.length > 0;

    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    if (wasUpdated)
      await client.query(
        `
        UPDATE pizzas 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
        [data.id]
      );

    return wasUpdated;
  }

  const results = await makeTransaction(queries, beforeCommitCallback);

  return results[results.length - 1];
};

exports.update.ingredient = async (data) => {
  const queries = [
    {
      // Lock relevant rows
      text: `SELECT * FROM ingredients WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM ingredients_categories_rules WHERE ingredient_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas_ingredients WHERE ingredient_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      text: `UPDATE ingredients 
             SET name = $1, 
             is_protected = $2,
             notes = $3,
             price = $4,
             stock = $5
             WHERE id = $6 
             AND (name IS DISTINCT FROM $1 OR 
             is_protected IS DISTINCT FROM $2 OR
             notes IS DISTINCT FROM $3 OR
             price IS DISTINCT FROM $4 OR
             stock IS DISTINCT FROM $5 
             ) 
             RETURNING id;`,
      data: [
        data.name,
        data.is_protected ?? false,
        data.notes ?? "",
        data.price,
        data.stock,
        data.id,
      ],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM ingredients_categories_rules
         WHERE ingredient_id = $1 AND rule_type='enforcing'
         RETURNING category_id;`,
      data: [data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM ingredients_categories_rules
         WHERE ingredient_id = $1 AND rule_type='incompatible'
         RETURNING category_id;`,
      data: [data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM pizzas_ingredients
         WHERE ingredient_id = $1
         RETURNING pizza_id;`,
      data: [data.id],
    },
  ];

  let nextIdx = queries.length;
  const idxCreated = {};

  if (
    data.enforcedCategories instanceof Array &&
    data.enforcedCategories.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT $1, category_id, 'enforcing'
         FROM (
            ${queryTextGetIdFromName("categories", "category_id", "$2", true)}
         )
         RETURNING category_id`,
      data: [data.id, data.enforcedCategories],
    });
    idxCreated.enforcedCategories = nextIdx++;
  }

  if (
    data.incompatibleCategories instanceof Array &&
    data.incompatibleCategories.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT $1, category_id, 'incompatible'
         FROM (
            ${queryTextGetIdFromName("categories", "category_id", "$2", true)}
         )
         RETURNING category_id`,
      data: [data.id, data.incompatibleCategories],
    });
    idxCreated.incompatibleCategories = nextIdx++;
  }

  if (data.pizzas instanceof Array && data.pizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_ingredients (pizza_id,ingredient_id)
         SELECT pizza_id, $1
         FROM (
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$2", true)}
         )
         RETURNING pizza_id`,
      data: [data.id, data.pizzas],
    });
    idxCreated.pizzas = nextIdx++;
  }

  async function beforeCommitCallback(client, results) {
    const updatedIngredient = results[3]?.[0]?.id;
    const updatedEnforcedCategories = updatedItems(
      results,
      4,
      idxCreated.enforcedCategories,
      "category_id"
    );
    const updatedIncompatibleCategories = updatedItems(
      results,
      5,
      idxCreated.incompatibleCategories,
      "category_id"
    );
    const updatedCategories = merge(
      updatedEnforcedCategories,
      updatedIncompatibleCategories
    );
    const updatedPizzas = updatedItems(
      results,
      6,
      idxCreated.pizzas,
      "pizza_id"
    );

    // updating a pizza's ingredients / categories just count as an update to the pizza,
    // but not to the ingredients / categories
    // updating a ingredient - category rule, count as an update of both
    const pizzasWereUpdated = updatedPizzas.length > 0;
    const categoriesWereUpdated = updatedCategories.length > 0;
    const thisIngredientWasUpdated =
      updatedIngredient != null || categoriesWereUpdated;
    const anyUpdated = thisIngredientWasUpdated || pizzasWereUpdated;

    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    if (thisIngredientWasUpdated)
      await client.query(
        `
        UPDATE ingredients 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
        [data.id]
      );

    if (pizzasWereUpdated) {
      await client.query(
        `
        UPDATE pizzas 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[]);
      `,
        [updatedPizzas]
      );
    }

    if (categoriesWereUpdated) {
      await client.query(
        `
        UPDATE categories 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[]);
      `,
        [updatedCategories]
      );
    }

    return anyUpdated;
  }

  const results = await makeTransaction(queries, beforeCommitCallback);

  return results[results.length - 1];
};

exports.update.category = async (data) => {
  const queries = [
    {
      // Lock relevant rows
      text: `SELECT * FROM categories WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM ingredients_categories_rules WHERE category_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas_categories WHERE category_id = $1 FOR UPDATE;`,
      data: [data.id],
    },
    {
      text: `UPDATE categories 
             SET name = $1, 
             is_protected = $2,
             notes = $3
             WHERE id = $4 
             AND (name IS DISTINCT FROM $1 OR 
             is_protected IS DISTINCT FROM $2 OR
             notes IS DISTINCT FROM $3
             ) 
             RETURNING id;`,
      data: [data.name, data.is_protected ?? false, data.notes ?? "", data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM ingredients_categories_rules
         WHERE category_id = $1 AND rule_type='enforcing'
         returning ingredient_id;`,
      data: [data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM ingredients_categories_rules
         WHERE category_id = $1 AND rule_type='incompatible'
         returning ingredient_id;`,
      data: [data.id],
    },
    {
      text: `
         -- Delete all existing links (they are re-created (updated) next)
         DELETE FROM pizzas_categories
         WHERE category_id = $1
         RETURNING pizza_id;`,
      data: [data.id],
    },
  ];

  let nextIdx = queries.length;
  const idxCreated = {};

  if (
    data.enforcingIngredients instanceof Array &&
    data.enforcingIngredients.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, $1, 'enforcing'
         FROM (
            ${queryTextGetIdFromName(
              "ingredients",
              "ingredient_id",
              "$2",
              true
            )}
         )
         RETURNING ingredient_id`,
      data: [data.id, data.enforcingIngredients],
    });
    idxCreated.enforcingIngredients = nextIdx++;
  }

  if (
    data.incompatibleIngredients instanceof Array &&
    data.incompatibleIngredients.length > 0
  ) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, $1, 'incompatible'
         FROM (
            ${queryTextGetIdFromName(
              "ingredients",
              "ingredient_id",
              "$2",
              true
            )}
         )
         RETURNING ingredient_id`,
      data: [data.id, data.incompatibleIngredients],
    });
    idxCreated.incompatibleIngredients = nextIdx++;
  }

  if (data.pizzas instanceof Array && data.pizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT pizza_id, $1
         FROM (
            ${queryTextGetIdFromName("pizzas", "pizza_id", "$2", true)}
         )
         RETURNING pizza_id`,
      data: [data.id, data.pizzas],
    });
    idxCreated.pizzas = nextIdx++;
  }

  async function beforeCommitCallback(client, results) {
    const now = new Date().toISOString();

    const updatedCategory = results[3]?.[0]?.id;
    const updatedEnforcingIngredients = updatedItems(
      results,
      4,
      idxCreated.enforcingIngredients,
      "ingredient_id"
    );
    const updatedIncompatibleIngredients = updatedItems(
      results,
      5,
      idxCreated.incompatibleIngredients,
      "ingredient_id"
    );
    const updatedIngredients = merge(
      updatedEnforcingIngredients,
      updatedIncompatibleIngredients
    );
    const updatedPizzas = updatedItems(
      results,
      6,
      idxCreated.pizzas,
      "pizza_id"
    );

    // updating a pizza's ingredients / categories just count as an update to the pizza,
    // but not to the ingredients / categories
    // updating a ingredient - category rule, count as an update of both
    const pizzasWereUpdated = updatedPizzas.length > 0;
    const ingredientsWereUpdated = updatedIngredients.length > 0;
    const thisCategoryWasUpdated =
      updatedCategory != null || ingredientsWereUpdated;
    const anyUpdated = thisCategoryWasUpdated || pizzasWereUpdated;

    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    if (thisCategoryWasUpdated)
      await client.query(
        `
        UPDATE categories 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
        [data.id]
      );

    if (pizzasWereUpdated) {
      await client.query(
        `
        UPDATE pizzas 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[]);
      `,
        [updatedPizzas]
      );
    }

    if (ingredientsWereUpdated) {
      await client.query(
        `
        UPDATE ingredients 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[]);
      `,
        [updatedIngredients]
      );
    }

    return anyUpdated;
  }
  const results = await makeTransaction(queries, beforeCommitCallback);

  return results[results.length - 1];
};

exports.delete.category = async (id) => {
  const queries = [
    {
      text: "DELETE FROM pizzas_categories WHERE category_id = $1;",
      data: [id],
    },
    {
      text: "DELETE FROM ingredients_categories_rules WHERE category_id = $1;",
      data: [id],
    },
    {
      text: "DELETE FROM categories WHERE id = $1 RETURNING id;",
      data: [id],
    },
  ];

  const results = await makeTransaction(queries);

  return results[2][0].id;
};

exports.delete.pizza = async (id) => {
  const queries = [
    {
      text: "DELETE FROM pizzas_ingredients WHERE pizza_id = $1;",
      data: [id],
    },
    {
      text: "DELETE FROM pizzas_categories WHERE pizza_id = $1;",
      data: [id],
    },
    {
      text: "DELETE FROM pizzas WHERE id = $1 RETURNING id;",
      data: [id],
    },
  ];

  const results = await makeTransaction(queries);

  return results[2][0].id;
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
      id,
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

// This gets only the essential info for edit a pizza
exports.read.pizzaDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected
      FROM pizzas
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

exports.read.pizzaProtected = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        is_protected
      FROM pizzas
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0].is_protected;
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
      id,
      name,
      is_protected
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

// This gets only the essential info for edit a ingredient
exports.read.ingredientDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected
      FROM ingredients
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

exports.read.ingredientProtected = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        is_protected
      FROM ingredients
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0].is_protected;
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

// This gets only the essential info for edit a category
exports.read.categoryDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected
      FROM categories
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

exports.read.categoryProtected = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        is_protected
      FROM categories
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0].is_protected;
};

function symmetricDifference(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);

  const result = [
    ...a.filter((x) => !setB.has(x)),
    ...b.filter((x) => !setA.has(x)),
  ];

  return result;
}

function merge(a, b) {
  return [...new Set([...a, ...b])];
}

function getItems(results, idx, itemLabel) {
  return results[idx]?.map((itm) => itm[itemLabel]) || [];
}

function updatedItems(results, deletedIdx, createdIdx, itemLabel) {
  const deletedItems = getItems(results, deletedIdx, itemLabel);
  const createdItems = getItems(results, createdIdx, itemLabel);

  return symmetricDifference(deletedItems, createdItems);
}
