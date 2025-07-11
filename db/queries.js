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

exports.create.category = async (data) => {
  // Adding a new category to the database means editing more than one table:
  // categories, pizzas_categories, ingredients_incompatible_categories, ingredients_enforced_categories
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Currently, only the categories table is updated.
  //
  // Sample data:
  // {
  //    "name": "Bianche",
  //    "is_protected": false,
  //    "enforcing_ingredients": ["Mozzarella"],
  //    "incompatible_ingredients": ["Pomodoro"],
  //    "pizzas": []
  // }

  const queries = [
    {
      text: "INSERT INTO categories (name,is_protected) VALUES($1,$2);",
      data: [data.name, data.is_protected ?? false],
    },
  ];

  await makeTransaction(queries);
};

exports.create.ingredient = async (data) => {
  // Adding a new ingredient to the database means editing more than one table:
  // ingredients, pizzas_ingredients, ingredients_incompatible_categories, ingredients_enforced_categories
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Currently, only the ingredients table is updated.
  //
  // Sample data:
  // {
  //    "name": "Pomodoro",
  //    "is_protected": false,
  //    "enforcedCategories": ["Rosse"],
  //    "incompatibleCategories": ["Bianche"],
  //    "price": "0.5",
  //    "stock": "200"
  //    "pizzas": []
  // }

  const queries = [
    {
      text: "INSERT INTO ingredients (name,is_protected,price,stock) VALUES($1,$2,$3,$4);",
      data: [data.name, data.is_protected ?? false, data.price, data.stock],
    },
  ];

  await makeTransaction(queries);
};

exports.create.pizza = async (data) => {
  // Adding a new pizza to the database means editing more than one table:
  // pizzas, pizzas_categories, pizzas_ingredients
  //
  // Hence a transaction is used, to ensure a consistend update  and allowing a rollback in case of errors.
  //
  // Currently, only the pizzas table is updated.
  //
  // Sample data:
  // {
  //    "name": "Margherita",
  //    "ingredients": ["Pomodoro", "Mozzarella", "Basilico", "Olio"],
  //    "customCategories": ["Classiche", "Vegetariane"],
  //    "is_protected": false,
  //    "notes": "Some notes"
  // }

  const queries = [
    {
      text: "INSERT INTO pizzas (name,is_protected,notes) VALUES($1,$2,$3);",
      data: [data.name, data.is_protected ?? false, data.notes ?? ""],
    },
  ];

  await makeTransaction(queries);
};
