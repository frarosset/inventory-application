const { awaitQueries, queryTextGetIdFromName } = require("./queriesHelpers.js");

const updateBeforeCommitCallback = {};

updateBeforeCommitCallback.pizza = (data) => async (client, results) => {
  const queries0 = [
    {
      // Lock relevant rows
      text: `SELECT * FROM pizzas WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
  ];

  await awaitQueries(client, queries0, results); // results is updated by reference

  if (results[0].length === 0) {
    return [...results, false];
  }

  // The pizza exists: get the data to update next
  const queries1To5 = [
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
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "categories",
        "category_id",
        "$1",
        true
      )}`,
      data: [data.categories],
    },
    {
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "ingredients",
        "ingredient_id",
        "$1",
        true
      )}`,
      data: [data.ingredients],
    },
  ];

  await awaitQueries(client, queries1To5, results); // results is updated by reference

  const oldCategories = getIds(results[1], "category_id");
  const oldIngredients = getIds(results[2], "ingredient_id");

  const newCategories = getIds(results[3], "category_id");
  const newIngredients = getIds(results[4], "ingredient_id");

  const [delCategories, insCategories] = computeDelAndInsItems(
    oldCategories,
    newCategories
  );
  const [delIngredients, insIngredients] = computeDelAndInsItems(
    oldIngredients,
    newIngredients
  );

  const updatedCategories = merge(delCategories, insCategories);

  const updatedIngredients = merge(delIngredients, insIngredients);

  const pizzaPropsWereUpdated = hasChanged(results[0]?.[0], data, [
    "name",
    "is_protected",
    "notes",
  ]);

  // updating a pizza's ingredients / categories just count as an update to the pizza,
  // but not to the ingredients / categories
  const thisPizzaWasUpdated =
    pizzaPropsWereUpdated ||
    updatedCategories.length > 0 ||
    updatedIngredients.length > 0;

  // console.log({
  //   oldCategories,
  //   newCategories,
  //   delCategories,
  //   insCategories,
  //   oldIngredients,
  //   newIngredients,
  //   delIngredients,
  //   insIngredients,
  //   updatedCategories,
  //   updatedIngredients,
  //   pizzaPropsWereUpdated,
  //   thisPizzaWasUpdated,
  // });

  const queries = [];

  if (pizzaPropsWereUpdated) {
    // Update the item itself
    queries.push({
      text: `
          UPDATE pizzas
          SET name = $1,
          is_protected = $2,
          notes = $3,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          AND (name IS DISTINCT FROM $1 OR 
          is_protected IS DISTINCT FROM $2 OR
          notes IS DISTINCT FROM $3
          )
          RETURNING id;`,
      data: [data.name, data.is_protected ?? false, data.notes ?? "", data.id],
    });
  } else if (thisPizzaWasUpdated) {
    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    queries.push({
      text: `
          UPDATE pizzas 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;`,
      data: [data.id],
    });
  }

  if (delCategories.length > 0) {
    queries.push({
      text: `
         DELETE FROM pizzas_categories
         WHERE pizza_id = $1 AND category_id = ANY($2::int[]);`,
      data: [data.id, delCategories],
    });
  }

  if (delIngredients.length > 0) {
    queries.push({
      text: `
         DELETE FROM pizzas_ingredients
         WHERE pizza_id = $1 AND ingredient_id = ANY($2::int[]);`,
      data: [data.id, delIngredients],
    });
  }

  if (insCategories.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT $1, category_id
         FROM UNNEST($2::int[]) AS category_id`,
      data: [data.id, insCategories],
    });
  }

  if (insIngredients.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_ingredients (pizza_id,ingredient_id)
         SELECT $1, ingredient_id
         FROM UNNEST($2::int[]) AS ingredient_id`,
      data: [data.id, insIngredients],
    });
  }

  await awaitQueries(client, queries, results); // results is updated by reference

  results.push(thisPizzaWasUpdated);

  return results;
};

updateBeforeCommitCallback.ingredient = (data) => async (client, results) => {
  const queries0 = [
    {
      // Lock relevant rows
      text: `SELECT * FROM ingredients WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
  ];

  await awaitQueries(client, queries0, results); // results is updated by reference

  if (results[0].length === 0) {
    return [...results, false];
  }

  // The ingredient exists: get the data to update next
  const queries1To5 = [
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
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "categories",
        "category_id",
        "$1",
        true
      )}`,
      data: [data.enforcedCategories],
    },
    {
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "categories",
        "category_id",
        "$1",
        true
      )}`,
      data: [data.incompatibleCategories],
    },
    {
      // Get id involved in updated item
      text: `${queryTextGetIdFromName("pizzas", "pizza_id", "$1", true)}`,
      data: [data.pizzas],
    },
  ];

  await awaitQueries(client, queries1To5, results); // results is updated by reference

  const oldEnforcedCategories = getIdsWithRuleType(
    results[1],
    "category_id",
    "enforcing"
  );
  const oldIncompatibleCategories = getIdsWithRuleType(
    results[1],
    "category_id",
    "incompatible"
  );
  const oldPizzas = getIds(results[2], "pizza_id");

  const newEnforcedCategories = getIds(results[3], "category_id");
  const newIncompatibleCategories = getIds(results[4], "category_id");
  const newPizzas = getIds(results[5], "pizza_id");

  const [delEnforcedCategories, insEnforcedCategories] = computeDelAndInsItems(
    oldEnforcedCategories,
    newEnforcedCategories
  );
  const [delIncompatibleCategories, insIncompatibleCategories] =
    computeDelAndInsItems(oldIncompatibleCategories, newIncompatibleCategories);
  const [delPizzas, insPizzas] = computeDelAndInsItems(oldPizzas, newPizzas);

  // a category-ingredient pair cannot be both enforcing and incompatible
  const delCategories = merge(delEnforcedCategories, delIncompatibleCategories);

  const updatedCategories = merge(
    delCategories,
    insEnforcedCategories,
    insIncompatibleCategories
  );

  const updatedPizzas = merge(delPizzas, insPizzas);

  // Updating the stock only does not count as an update to the item:
  // the change to stock is applied, but updated_at is not edited
  const ingredientPropsWereUpdatedExclStock = hasChanged(
    results[0]?.[0],
    data,
    ["name", "is_protected", "notes", "price"]
  );

  const ingredientPropsWereUpdated =
    ingredientPropsWereUpdatedExclStock ||
    hasChanged(results[0]?.[0], data, ["stock"]);

  // updating a pizza's ingredients / categories just count as an update to the pizza,
  // but not to the ingredients / categories
  // updating a ingredient - category rule, count as an update of both
  const pizzasWereUpdated = updatedPizzas.length > 0;
  const categoriesWereUpdated = updatedCategories.length > 0;
  const thisIngredientWasUpdated =
    ingredientPropsWereUpdated || categoriesWereUpdated;
  const anyUpdated = thisIngredientWasUpdated || pizzasWereUpdated;

  // console.log({
  //   oldEnforcedCategories,
  //   newEnforcedCategories,
  //   delEnforcedCategories,
  //   insEnforcedCategories,
  //   oldIncompatibleCategories,
  //   newIncompatibleCategories,
  //   delIncompatibleCategories,
  //   insIncompatibleCategories,
  //   oldPizzas,
  //   newPizzas,
  //   delPizzas,
  //   insPizzas,
  //   delCategories,
  //   updatedCategories,
  //   updatedPizzas,
  //   ingredientPropsWereUpdated,
  //   pizzasWereUpdated,
  //   categoriesWereUpdated,
  //   thisIngredientWasUpdated,
  //   anyUpdated,
  // });

  const queries = [];

  if (ingredientPropsWereUpdated) {
    // Update the item itself
    queries.push({
      text: `
          UPDATE ingredients
          SET name = $1,
          is_protected = $2,
          notes = $3,
          price = $4,
          stock = $5
          ${
            ingredientPropsWereUpdatedExclStock
              ? ", updated_at = CURRENT_TIMESTAMP"
              : ""
          }
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
    });
  } else if (thisIngredientWasUpdated) {
    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    queries.push({
      text: `
          UPDATE ingredients 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;`,
      data: [data.id],
    });
  }

  if (delCategories.length > 0) {
    queries.push({
      text: `
         DELETE FROM ingredients_categories_rules
         WHERE ingredient_id = $1 AND category_id = ANY($2::int[]);`,
      data: [data.id, delCategories],
    });
  }

  if (delPizzas.length > 0) {
    queries.push({
      text: `
         DELETE FROM pizzas_ingredients
         WHERE ingredient_id = $1 AND pizza_id = ANY($2::int[]);`,
      data: [data.id, delPizzas],
    });
  }

  if (insEnforcedCategories.length > 0) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT $1, category_id, 'enforcing'
         FROM UNNEST($2::int[]) AS category_id`,
      data: [data.id, insEnforcedCategories],
    });
  }

  if (insIncompatibleCategories.length > 0) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT $1, category_id, 'incompatible'
         FROM UNNEST($2::int[]) AS category_id`,
      data: [data.id, insIncompatibleCategories],
    });
  }

  if (insPizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_ingredients (pizza_id, ingredient_id)
         SELECT pizza_id, $1
         FROM UNNEST($2::int[]) AS pizza_id`,
      data: [data.id, insPizzas],
    });
  }

  if (categoriesWereUpdated) {
    queries.push({
      text: `
          UPDATE categories 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
      data: [updatedCategories],
    });
  }

  if (pizzasWereUpdated) {
    queries.push({
      text: `
          UPDATE pizzas 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
      data: [updatedPizzas],
    });
  }

  await awaitQueries(client, queries, results); // results is updated by reference

  results.push(anyUpdated);

  return results;
};

updateBeforeCommitCallback.category = (data) => async (client, results) => {
  const queries0 = [
    {
      // Lock relevant rows
      text: `SELECT * FROM categories WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
  ];

  await awaitQueries(client, queries0, results); // results is updated by reference

  if (results[0].length === 0) {
    return [...results, false];
  }

  // The category exists: get the data to update next
  const queries1To5 = [
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
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "ingredients",
        "ingredient_id",
        "$1",
        true
      )}`,
      data: [data.enforcingIngredients],
    },
    {
      // Get id involved in updated item
      text: `${queryTextGetIdFromName(
        "ingredients",
        "ingredient_id",
        "$1",
        true
      )}`,
      data: [data.incompatibleIngredients],
    },
    {
      // Get id involved in updated item
      text: `${queryTextGetIdFromName("pizzas", "pizza_id", "$1", true)}`,
      data: [data.pizzas],
    },
  ];

  await awaitQueries(client, queries1To5, results); // results is updated by reference

  const oldEnforcingIngredients = getIdsWithRuleType(
    results[1],
    "ingredient_id",
    "enforcing"
  );
  const oldIncompatibleIngredients = getIdsWithRuleType(
    results[1],
    "ingredient_id",
    "incompatible"
  );
  const oldPizzas = getIds(results[2], "pizza_id");

  const newEnforcingIngredients = getIds(results[3], "ingredient_id");
  const newIncompatibleIngredients = getIds(results[4], "ingredient_id");
  const newPizzas = getIds(results[5], "pizza_id");

  const [delEnforcingIngredients, insEnforcingIngredients] =
    computeDelAndInsItems(oldEnforcingIngredients, newEnforcingIngredients);
  const [delIncompatibleIngredients, insIncompatibleIngredients] =
    computeDelAndInsItems(
      oldIncompatibleIngredients,
      newIncompatibleIngredients
    );
  const [delPizzas, insPizzas] = computeDelAndInsItems(oldPizzas, newPizzas);

  // a category-ingredient pair cannot be both enforcing and incompatible
  const delIngredients = merge(
    delEnforcingIngredients,
    delIncompatibleIngredients
  );

  const updatedIngredients = merge(
    delIngredients,
    insEnforcingIngredients,
    insIncompatibleIngredients
  );

  const updatedPizzas = merge(delPizzas, insPizzas);

  const categoryPropsWereUpdated = hasChanged(results[0]?.[0], data, [
    "name",
    "is_protected",
    "notes",
  ]);

  // updating a pizza's ingredients / categories just count as an update to the pizza,
  // but not to the ingredients / categories
  // updating a ingredient - category rule, count as an update of both
  const pizzasWereUpdated = updatedPizzas.length > 0;
  const ingredientsWereUpdated = updatedIngredients.length > 0;
  const thisCategoryWasUpdated =
    categoryPropsWereUpdated || ingredientsWereUpdated;
  const anyUpdated = thisCategoryWasUpdated || pizzasWereUpdated;

  // console.log({
  //   oldEnforcingIngredients,
  //   newEnforcingIngredients,
  //   delEnforcingIngredients,
  //   insEnforcingIngredients,{
  //   oldIncompatibleIngredients,
  //   newIncompatibleIngredients,
  //   delIncompatibleIngredients,
  //   insIncompatibleIngredients,
  //   oldPizzas,
  //   newPizzas,
  //   delPizzas,
  //   insPizzas,
  //   delIngredients,
  //   updatedIngredients,
  //   updatedPizzas,
  //   categoryPropsWereUpdated,
  //   pizzasWereUpdated,
  //   ingredientsWereUpdated,
  //   thisCategoryWasUpdated,
  //   anyUpdated,
  // });

  const queries = [];

  if (categoryPropsWereUpdated) {
    // Update the item itself
    queries.push({
      text: `
          UPDATE categories
          SET name = $1,
          is_protected = $2,
          notes = $3,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          AND (name IS DISTINCT FROM $1 OR
          is_protected IS DISTINCT FROM $2 OR
          notes IS DISTINCT FROM $3
          )
          RETURNING id;`,
      data: [data.name, data.is_protected ?? false, data.notes ?? "", data.id],
    });
  } else if (thisCategoryWasUpdated) {
    // Note: CURRENT_TIMESTAMP returns the start time of the current transaction
    queries.push({
      text: `
          UPDATE categories 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;`,
      data: [data.id],
    });
  }

  if (delIngredients.length > 0) {
    queries.push({
      text: `
         DELETE FROM ingredients_categories_rules
         WHERE category_id = $1 AND ingredient_id = ANY($2::int[]);`,
      data: [data.id, delIngredients],
    });
  }

  if (delPizzas.length > 0) {
    queries.push({
      text: `
         DELETE FROM pizzas_categories
         WHERE category_id = $1 AND pizza_id = ANY($2::int[]);`,
      data: [data.id, delPizzas],
    });
  }

  if (insEnforcingIngredients.length > 0) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, $1, 'enforcing'
         FROM UNNEST($2::int[]) AS ingredient_id`,
      data: [data.id, insEnforcingIngredients],
    });
  }

  if (insIncompatibleIngredients.length > 0) {
    queries.push({
      text: `
         INSERT INTO ingredients_categories_rules (ingredient_id,category_id, rule_type)
         SELECT ingredient_id, $1, 'incompatible'
         FROM UNNEST($2::int[]) AS ingredient_id`,
      data: [data.id, insIncompatibleIngredients],
    });
  }

  if (insPizzas.length > 0) {
    queries.push({
      text: `
         INSERT INTO pizzas_categories (pizza_id,category_id)
         SELECT pizza_id, $1
         FROM UNNEST($2::int[]) AS pizza_id`,
      data: [data.id, insPizzas],
    });
  }

  if (ingredientsWereUpdated) {
    queries.push({
      text: `
          UPDATE ingredients 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
      data: [updatedIngredients],
    });
  }

  if (pizzasWereUpdated) {
    queries.push({
      text: `
          UPDATE pizzas 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::int[]);`,
      data: [updatedPizzas],
    });
  }

  await awaitQueries(client, queries, results); // results is updated by reference

  results.push(anyUpdated);

  return results;
};

updateBeforeCommitCallback.dough = (data) => async (client, results) => {
  const queries0 = [
    {
      // Lock relevant rows
      text: `SELECT * FROM doughs WHERE id = $1 FOR UPDATE;`,
      data: [data.id],
    },
  ];

  await awaitQueries(client, queries0, results); // results is updated by reference

  if (results[0].length === 0) {
    return [...results, false];
  }

  // Updating the stock only does not count as an update to the item:
  // the change to stock is applied, but updated_at is not edited
  const doughPropsWereUpdatedExclStock = hasChanged(results[0]?.[0], data, [
    "name",
    "is_protected",
    "notes",
    "price",
  ]);

  const doughPropsWereUpdated =
    doughPropsWereUpdatedExclStock ||
    hasChanged(results[0]?.[0], data, ["stock"]);

  // console.log({
  //   doughPropsWereUpdated,
  // });

  const queries = [];

  if (doughPropsWereUpdated) {
    // Update the item itself
    queries.push({
      text: `
          UPDATE doughs
          SET name = $1,
          is_protected = $2,
          notes = $3,
          price = $4,
          stock = $5
          ${
            doughPropsWereUpdatedExclStock
              ? ", updated_at = CURRENT_TIMESTAMP"
              : ""
          }
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
    });
  }

  await awaitQueries(client, queries, results); // results is updated by reference

  results.push(doughPropsWereUpdated);

  return results;
};

// Helper functions

function merge(...arrays) {
  return [...new Set(arrays.flat())];
}

function toArray(x) {
  return x instanceof Array ? x : [];
}

function setDifference(a, b) {
  const setB = new Set(b);

  const result = [...new Set(a)].filter((x) => !setB.has(x));

  return result;
}

function computeDelAndInsItems(oldArr, newArr) {
  const toDelete = setDifference(oldArr, newArr);
  const toInsert = setDifference(newArr, oldArr);
  return [toDelete, toInsert];
}

function getIds(arr, idLabel) {
  return arr?.map((row) => row[idLabel]);
}

function getIdsWithRuleType(arr, idLabel, rule) {
  return arr?.filter((row) => row.rule_type == rule).map((row) => row[idLabel]);
}

function hasChanged(x, y, keys) {
  return keys.some((key) => key in y && x[key] != y[key]);
}

module.exports = { updateBeforeCommitCallback };
