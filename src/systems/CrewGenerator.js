export class CrewGenerator {
    static FIRST_NAMES = [
        "Jace", "Lyra", "Kael", "Mira", "Oren", "Zara", "Thorn", "Elara", "Jax", "Nia",
        "Rian", "Cora", "Vane", "Sola", "Kian", "Eris", "Dax", "Luna", "Torin", "Vega"
    ];

    static LAST_NAMES = [
        "Vance", "Ryder", "Stark", "Chen", "Novak", "Price", "Vega", "Solos", "Thorne", "Cross",
        "Moon", "Strider", "Frey", "Wong", "Sato", "Khan", "Webb", "Mercer", "Cole", "Reid"
    ];

    static ROLES = [
        { name: "Commander", tag: "LEADER" },
        { name: "Engineer", tag: "ENGINEER" },
        { name: "Biologist", tag: "MEDIC" },
        { name: "Security", tag: "SECURITY" },
        { name: "Specialist", tag: "SPECIALIST" }
    ];

    static generateCrew(count = 5) {
        let crew = [];

        // Ensure one Commander
        crew.push(this.createmember('Commander', 'LEADER'));

        // Fill rest
        for (let i = 1; i < count; i++) {
            const role = this.ROLES[Math.floor(Math.random() * (this.ROLES.length - 1)) + 1]; // Skip Commander
            crew.push(this.createmember(role.name, role.tag));
        }

        return crew;
    }

    static createmember(roleName, tag) {
        const first = this.FIRST_NAMES[Math.floor(Math.random() * this.FIRST_NAMES.length)];
        const last = this.LAST_NAMES[Math.floor(Math.random() * this.LAST_NAMES.length)];
        const gender = Math.random() > 0.5 ? 'M' : 'F';

        // Random Age 25-50
        const age = Math.floor(Math.random() * 25) + 25;

        return {
            id: Date.now() + Math.random(),
            name: `${roleName} ${last}`, // e.g., Engineer Vance
            realName: `${first} ${last}`,
            gender: gender,
            age: age,
            status: 'HEALTHY',
            tags: [tag],
            psych: 100 // New Sanity Stat?
        };
    }
}
