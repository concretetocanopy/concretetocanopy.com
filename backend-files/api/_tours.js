// Shared tour configuration used by multiple API functions.
// Keep this in sync with the tour cards in index.html.

const TOURS = {
  prod_UinWkshHnZa07a: { name: 'Don Valley Brickworks' },
  prod_UmETfoaOcDsQ5F: { name: 'Yellow Creek' },
  prod_UmEUF89WX3i75K: { name: 'West Don River' },
  prod_UnJtO3KxpcyRF5: { name: 'Wetland Forest Walk' }
};

const PRICE_PER_TICKET_CAD = 50;

const VALID_TIMES = ['9:30 AM', '12:30 PM', '3:30 PM'];

module.exports = { TOURS, PRICE_PER_TICKET_CAD, VALID_TIMES };
