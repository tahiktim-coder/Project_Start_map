/* Ship upgrades. `effect` is written in plain words: what changes for the player.
   `mount` says where the part shows up on the ship cutaway (ShipCutaway.js draws one add-on per id);
   `icon` is 12×12 pixel art for the fabricator card ('#' = part, '+' = highlight). */
const UPGRADES = {
    SENSOR_ARRAY_V2: {
        id: 'sensor_v2',
        name: 'Sensor Array V2',
        cost: 150,
        desc: 'A proper dish instead of the factory antenna.',
        effect: 'Long-range scan shows everything about a planet.',
        mount: 'Nose',
        icon: ['............', '...######...', '..#++++++#..', '.#++++++++#.', '.#++++++++#.', '..#++++++#..', '...######...', '.....##.....', '.....##.....', '.....##.....', '....####....', '...######...']
    },
    NANOFIBER_HULL: {
        id: 'nano_hull',
        name: 'Nanofiber Hull Plating',
        cost: 200,
        desc: 'Carbon-lattice armour over the whole hull.',
        effect: 'Probes take half damage.',
        mount: 'Whole hull',
        icon: ['############', '#++#++#++#+#', '############', '#+#++#++#++#', '############', '#++#++#++#+#', '############', '#+#++#++#++#', '############', '#++#++#++#+#', '############', '............']
    },
    AUTODOC_MEDBAY: {
        id: 'autodoc',
        name: 'Autodoc Medbay',
        cost: 250,
        desc: 'A surgical pod that works while everyone sleeps.',
        effect: 'Injured crew heal a little on every warp.',
        mount: 'Laboratory',
        icon: ['............', '.##########.', '.#........#.', '.#...++...#.', '.#...++...#.', '.#.++++++.#.', '.#.++++++.#.', '.#...++...#.', '.#...++...#.', '.#........#.', '.##########.', '............']
    },
    FUEL_SCOOP: {
        id: 'fuel_scoop',
        name: 'Bussard Fuel Scoop',
        cost: 100,
        desc: 'Magnetic funnels that drink hydrogen.',
        effect: 'Orbiting a gas giant refuels 5–10 energy.',
        mount: 'Beside the nose',
        icon: ['#..........#', '##........##', '#+#......#+#', '#++#....#++#', '.#++#..#++#.', '..#++##++#..', '...#++++#...', '....#++#....', '....#++#....', '....####....', '.....##.....', '.....##.....']
    },
    GYRO_FINS: {
        id: 'gyro_fins',
        name: 'Gyro Stabiliser Fins',
        cost: 120,
        desc: 'Fins that hold the ship steady through a burn.',
        effect: 'Warp plotting is easier: the lock window is 25% wider.',
        mount: 'Stern',
        icon: ['.....##.....', '.....##.....', '....####....', '....#++#....', '....#++#....', '...##++##...', '..#+#++#+#..', '.#++#++#++#.', '#+++#++#+++#', '#####++#####', '....####....', '.....##.....']
    },
    CARGO_RACKS: {
        id: 'cargo_racks',
        name: 'Extra Cargo Racks',
        cost: 90,
        desc: 'A sixth pallet bay welded along the hold wall.',
        effect: 'The hold takes 4 more items (24 instead of 20).',
        mount: 'Cargo hold',
        icon: ['############', '#..........#', '#.###..###.#', '#.#+#..#+#.#', '#.###..###.#', '############', '#..........#', '#.###..###.#', '#.#+#..#+#.#', '#.###..###.#', '############', '.#........#.']
    },
    SHIELDED_CORE: {
        id: 'shield_core',
        name: 'Shielded Drive Core',
        cost: 140,
        desc: 'A containment ring around the reactor.',
        effect: 'A bad warp plot no longer burns extra fuel.',
        mount: 'Engineering',
        icon: ['...######...', '..#......#..', '.#..####..#.', '#..#++++#..#', '#.#++++++#.#', '#.#++++++#.#', '#.#++++++#.#', '#.#++++++#.#', '#..#++++#..#', '.#..####..#.', '..#......#..', '...######...']
    }
};
