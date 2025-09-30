function hasProtectedSelectedEdited(
  isEdit,
  selected = [],
  allProtectedPizzas = [],
  prevProtectedSelected = []
) {
  let askPassword;

  const protectedValuesSet = new Set(allProtectedPizzas);
  const protectedSelected =
    selected?.filter((pizza) => protectedValuesSet.has(pizza)) ?? [];

  if (isEdit) {
    const prevProtectedSelectedSet = new Set(prevProtectedSelected);
    const protectedSelectedSet = new Set(protectedSelected);

    const wereUnselected = prevProtectedSelected.filter(
      (x) => !protectedSelectedSet.has(x)
    );
    const wereSelected = protectedSelected.filter(
      (x) => !prevProtectedSelectedSet.has(x)
    );

    const anyWereUnselected = wereUnselected.length > 0;
    const anyWereSelected = wereSelected.length > 0;

    askPassword = anyWereUnselected || anyWereSelected;

    // console.log({
    //   prevProtectedSelected,
    //   protectedSelected,
    //   wereUnselected,
    //   wereSelected,
    //   askPassword,
    // });
  } else {
    askPassword = protectedSelected.length > 0;

    // console.log({ protectedSelected, askPassword });
  }

  return askPassword;
}

module.exports = hasProtectedSelectedEdited;
