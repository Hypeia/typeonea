const GRID_SIZE = 100;

const grid = document.getElementById("grid")!;

for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.addEventListener("click", () => {
    cell.classList.toggle("filled");
  });
  grid.appendChild(cell);
}
