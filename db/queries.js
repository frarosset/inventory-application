const pool = require("./pool.js");
const {
  makeTransaction,
  queryTextGetIdFromName,
  awaitQueries,
} = require("./queriesHelpers.js");
const { updateBeforeCommitCallback } = require("./queriesUpdateHelpers.js");

exports.create = {};
exports.read = {};
exports.update = {};
exports.delete = {};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitSearchTermsInName(data) {
  if (!data.q || !data.q.trim()) {
    return { sqlStr: "TRUE", sqlValues: [] }; // returns all rows
  }

  const props = {};

  // ILIKE: case insensitive
  const likeStr = data.fullWord
    ? data.caseSensitive
      ? "~"
      : "~*"
    : data.caseSensitive
    ? "LIKE"
    : "ILIKE";
  // partial word search with %...%
  const wordStr = (q) => (data.fullWord ? `\\m${escapeRegex(q)}\\M` : `%${q}%`);

  if (data.exactMatch) {
    props.sqlStr = `name ${likeStr} $1`;
    // partial word search
    props.sqlValues = [wordStr(data.q)];
  } else {
    const terms = data.q.trim().split(/\s+/);
    const joinStr = data.matchAllWords ? " AND " : " OR ";

    props.sqlStr = terms
      .map((_, i) => `name ${likeStr} $${i + 1}`)
      .join(joinStr);
    // partial word search
    props.sqlValues = terms.map((term) => wordStr(term));
  }

  return props;
}

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

exports.create.dough = async (data) => {
  // Adding a new dough to the database means editing just one table:
  //
  // A transaction is used for consistency with other operations.
  //
  // Sample data:
  // {
  //    "name": "Base",
  //    "is_protected": false,
  //    "notes": "Some notes"
  //    "price": "5",
  //    "stock": "200"
  // }

  const queries = [
    {
      text: "INSERT INTO doughs (name,is_protected,notes,price,stock) VALUES($1,$2,$3,$4,$5) RETURNING id;",
      data: [
        data.name,
        data.is_protected ?? false,
        data.notes ?? "",
        data.price,
        data.stock,
      ],
    },
  ];

  const results = await makeTransaction(queries);

  return results[0][0].id;
};

exports.update.pizza = async (data) => {
  const beforeCommitCallback = updateBeforeCommitCallback.pizza(data);

  const results = await makeTransaction([], beforeCommitCallback);

  const id = results[0]?.[0]?.id;
  const updated = results[results.length - 1]; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.ingredient = async (data) => {
  const beforeCommitCallback = updateBeforeCommitCallback.ingredient(data);

  const results = await makeTransaction([], beforeCommitCallback);

  const id = results[0]?.[0]?.id;
  const updated = results[results.length - 1]; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.category = async (data) => {
  const beforeCommitCallback = updateBeforeCommitCallback.category(data);

  const results = await makeTransaction([], beforeCommitCallback);

  const id = results[0]?.[0]?.id;
  const updated = results[results.length - 1]; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.dough = async (data) => {
  const beforeCommitCallback = updateBeforeCommitCallback.dough(data);

  const results = await makeTransaction([], beforeCommitCallback);

  const id = results[0]?.[0]?.id;
  const updated = results[results.length - 1]; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.ingredientRestock = async (data) => {
  // do not edit updated at when editing the stock
  const queries = [
    {
      text: `
          UPDATE ingredients
          SET stock = stock + $1
          WHERE id = $2
          AND ($1 > 0)
          RETURNING id;`,
      data: [data.unitsToRestock, data.id],
    },
  ];

  const results = await makeTransaction(queries);

  const id = results[0]?.[0]?.id;
  const updated = id != null; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.doughRestock = async (data) => {
  // do not edit updated at when editing the stock
  const queries = [
    {
      text: `
          UPDATE doughs
          SET stock = stock + $1
          WHERE id = $2
          AND ($1 > 0)
          RETURNING id;`,
      data: [data.unitsToRestock, data.id],
    },
  ];

  const results = await makeTransaction(queries);

  const id = results[0]?.[0]?.id;
  const updated = id != null; // last result is the result of beforeCommitCallback

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.update.pizzaOrder = async (data) => {
  // do not edit updated at when editing the stock
  const queries = [
    //lock doughs and ingredients that will be edited
    {
      text: `
        SELECT id, stock FROM doughs WHERE id = $1 FOR UPDATE;`,
      data: [data.doughId],
    },
    {
      text: `
        SELECT id, stock FROM ingredients
        WHERE id = ANY (
          SELECT ingredient_id FROM pizzas_ingredients WHERE pizza_id = $1
        )
        FOR UPDATE;`,
      data: [data.id],
    },
    {
      text: `
          UPDATE doughs
          SET stock = stock - $1
          WHERE id = $2
          AND ($1 > 0)
          RETURNING id;`,
      data: [data.unitsToOrder, data.doughId],
    },
    {
      text: `
          UPDATE ingredients
          SET stock = stock - $1
           WHERE id = ANY (
            SELECT ingredient_id
            FROM pizzas_ingredients
            WHERE pizza_id = $2
          )
          AND ($1 > 0)
          RETURNING id;`,
      data: [data.unitsToOrder, data.id],
    },
  ];

  const results = await makeTransaction(queries);

  const id = data.id;
  const updated = data.unitsToOrder > 0;

  // returns {id, updated} -- id is undefined if item does not exist
  return { id, updated };
};

exports.delete.ingredient = async (id) => {
  // deleting a ingredient counts as an operation on the ingredient and the associated pizzas and categories,
  // hence you need to update the updated_at propery on them

  const queries = [
    {
      text: "DELETE FROM pizzas_ingredients WHERE ingredient_id = $1 RETURNING pizza_id;",
      data: [id],
    },
    {
      text: "DELETE FROM ingredients_categories_rules WHERE ingredient_id = $1 RETURNING category_id;",
      data: [id],
    },
    {
      text: "DELETE FROM ingredients WHERE id = $1 RETURNING id;",
      data: [id],
    },
  ];
  const beforeCommitCallback = async (client, results) => {
    const queries = [];

    const updatedPizzas = results[0].map((x) => x.pizza_id);
    const updatedCategories = results[1].map((x) => x.category_id);

    if (updatedPizzas.length > 0) {
      queries.push({
        text: `
          UPDATE pizzas 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
        data: [updatedPizzas],
      });
    }

    if (updatedCategories.length > 0) {
      queries.push({
        text: `
          UPDATE categories 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
        data: [updatedCategories],
      });
    }

    await awaitQueries(client, queries, results); // results is updated by reference
  };

  const results = await makeTransaction(queries, beforeCommitCallback);

  return results[2]?.[0]?.id;
};

exports.delete.category = async (id) => {
  // deleting a category counts as an operation on the category and the associated pizzas and ingredients,
  // hence you need to update the updated_at propery on them

  const queries = [
    {
      text: "DELETE FROM pizzas_categories WHERE category_id = $1 RETURNING pizza_id;",
      data: [id],
    },
    {
      text: "DELETE FROM ingredients_categories_rules WHERE category_id = $1 RETURNING ingredient_id;",
      data: [id],
    },
    {
      text: "DELETE FROM categories WHERE id = $1 RETURNING id;",
      data: [id],
    },
  ];

  const beforeCommitCallback = async (client, results) => {
    const queries = [];

    const updatedPizzas = results[0].map((x) => x.pizza_id);
    const updatedIngredients = results[1].map((x) => x.ingredient_id);

    if (updatedPizzas.length > 0) {
      queries.push({
        text: `
          UPDATE pizzas 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
        data: [updatedPizzas],
      });
    }

    if (updatedIngredients.length > 0) {
      queries.push({
        text: `
          UPDATE ingredients 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
        data: [updatedIngredients],
      });
    }

    await awaitQueries(client, queries, results); // results is updated by reference
  };

  const results = await makeTransaction(queries, beforeCommitCallback);

  return results[2]?.[0]?.id;
};

exports.delete.pizza = async (id) => {
  // deleting a pizza counts as an operation on the pizza only: it does not
  // need to update the updated_at propery on ingredients or categories

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

  return results[2]?.[0]?.id;
};

exports.delete.dough = async (id) => {
  const queries = [
    {
      text: `DELETE FROM doughs WHERE id = $1 AND id != ${process.env.BASE_DOUGH_ID} RETURNING id;`,
      data: [id],
    },
  ];

  const results = await makeTransaction(queries);

  return results[0]?.[0]?.id;
};

// This gets only the essential info for all pizzas in the db
exports.read.pizzasBrief = async () => {
  const { rows } = await pool.query(`
    SELECT *
    FROM pizzas_brief
    ORDER BY id; 
  `);

  return rows;
};

exports.read.pizzasBriefSearch = async (queriesName) => {
  const { sqlStr, sqlValues } = splitSearchTermsInName(queriesName);

  const { rows } = await pool.query(
    `
    SELECT *
    FROM pizzas_brief
    WHERE ${sqlStr}
    ORDER BY id;
  `,
    sqlValues
  );

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
        COALESCE(ingredients_total_cost, 0) + d.price AS cost,
        LEAST(COALESCE(ingredients_availability, d.stock), d.stock) AS availability,
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
      ON p.id = cp.pizza_id
      JOIN base_dough AS d
      ON true;
    `,
    [id]
  );

  return rows[0];
};

exports.read.doughVariantsPerPizza = async (id) => {
  const { rows } = await pool.query(
    `SELECT 
       d.id AS id,
       d.name AS name,
       d.stock AS dough_stock,
       d.price AS dough_price,
       COALESCE(ip.ingredients_total_cost, 0) + d.price AS pizza_cost,
       LEAST(COALESCE(ip.ingredients_availability, d.stock), d.stock) AS pizza_availability
     FROM doughs AS d
     JOIN ingredients_per_pizza AS ip
     ON ip.pizza_id = $1
     ORDER BY id;
    `,
    [id]
  );

  return rows;
};

// This gets only the essential info to edit a pizza
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

// This gets only the essential info to delete a pizza
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

// This gets only the essential info to order a pizza
exports.read.pizzaOrder = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        availability
      FROM pizzas_brief
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

  return rows[0]?.is_protected;
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

exports.read.ingredientsBriefSearch = async (queriesName) => {
  const { sqlStr, sqlValues } = splitSearchTermsInName(queriesName);

  const { rows } = await pool.query(
    `
    SELECT 
      id,
      name,
      is_protected,
      stock,
      price
    FROM ingredients
    WHERE ${sqlStr}
    ORDER BY id;
  `,
    sqlValues
  );

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

// This gets only the essential info to edit an ingredient
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

// This gets only the essential info to delete a ingredient
exports.read.ingredientDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(protected_pizzas,'[]'::json) AS protected_pizzas
      FROM ingredients AS i
      LEFT JOIN pizzas_names_per_ingredient AS pi
      ON i.id = pi.ingredient_id
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

  return rows[0]?.is_protected;
};

// This gets only the essential info to restock a ingredient
exports.read.ingredientRestock = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        stock
      FROM ingredients
      WHERE id=$1;
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

exports.read.categoriesBriefSearch = async (queriesName) => {
  const { sqlStr, sqlValues } = splitSearchTermsInName(queriesName);

  const { rows } = await pool.query(
    `
    SELECT 
      id,
      name,
      is_protected
    FROM categories
    WHERE ${sqlStr}
    ORDER BY id;
  `,
    sqlValues
  );

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

// This gets only the essential info to edit a category
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

// This gets only the essential info to delete a category
exports.read.categoryDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected,
        COALESCE(pizzas,'[]'::json) AS pizzas,
        COALESCE(protected_pizzas,'[]'::json) AS protected_pizzas
      FROM categories AS c
      LEFT JOIN pizzas_names_per_category AS pc
      ON c.id = pc.category_id
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

  return rows[0]?.is_protected;
};

exports.read.doughsBrief = async () => {
  const { rows } = await pool.query(`
    SELECT 
      id,
      name,
      is_protected,
      stock,
      price
    FROM doughs
    ORDER BY id;
  `);

  return rows;
};

exports.read.dough = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT * 
      FROM doughs
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

// This gets only the essential info to edit a dough
exports.read.doughEdit = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT * 
      FROM doughs
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

// This gets only the essential info to restock a dough
exports.read.doughRestock = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        stock
      FROM doughs
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

exports.read.doughsNames = async () => {
  const { rows } = await pool.query(`
    SELECT 
      id,
      name,
      is_protected
    FROM doughs
    ORDER BY id;
  `);

  return rows;
};

// This gets only the essential info to delete a dough
exports.read.doughDelete = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        name,
        id,
        is_protected
      FROM doughs
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0];
};

exports.read.doughProtected = async (id) => {
  const { rows } = await pool.query(
    `
      SELECT 
        is_protected
      FROM doughs
      WHERE id=$1;
    `,
    [id]
  );

  return rows[0]?.is_protected;
};

exports.read.doughsBriefSearch = async (queriesName) => {
  const { sqlStr, sqlValues } = splitSearchTermsInName(queriesName);

  const { rows } = await pool.query(
    `
    SELECT 
      id,
      name,
      is_protected,
      stock,
      price
    FROM doughs
    WHERE ${sqlStr}
    ORDER BY id;
  `,
    sqlValues
  );

  return rows;
};
