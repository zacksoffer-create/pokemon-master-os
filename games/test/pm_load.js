// Loads the scoring engine's modules plus Playmaker's into one Node context.
module.exports = () => require('./load')(['hoops/court.js', 'hoops/physics.js', 'hoops/defense.js', 'hoops/help.js', 'hoops/pm-plays.js', 'hoops/pm-sim.js']);
