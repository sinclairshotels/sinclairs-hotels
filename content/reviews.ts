export interface Review {
  quote: string;
  author: string;
  propertyName: string;
  rating: number;
  source: string;
  url: string;
}

export const reviews: Review[] = [
  {
    quote: 'Excellent customer service at Sinclair Hotel Darjeeling.',
    author: 'Bidur M.',
    propertyName: 'Sinclairs Darjeeling',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.in/Hotel_Review-g304557-d479541-Reviews-Sinclairs_Darjeeling-Darjeeling_Darjeeling_District_West_Bengal.html',
  },
  {
    quote: 'Bestest ever property to be in Kalimpong.',
    author: 'Dipankar P.',
    propertyName: 'Sinclairs Retreat Kalimpong',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.com/Hotel_Review-g503707-d7371470-Reviews-Sinclairs_Retreat_Kalimpong-Kalimpong_Kalimpong_District_West_Bengal.html',
  },
  {
    quote: 'A memorable stay with a breathtaking sea view.',
    author: 'Ankita',
    propertyName: 'Sinclairs Bayview Port Blair',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.com/Hotel_Review-g297584-d1062564-Reviews-Sinclairs_Bayview_Port_Blair-Port_Blair_South_Andaman_Island_Andaman_and_Nicobar_Islan.html',
  },
  {
    quote: 'The property is massive, beautifully landscaped, and perched on a hilltop.',
    author: 'Prakriti',
    propertyName: 'Sinclairs Retreat Dooars',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.com/Hotel_Review-g1549815-d1549339-Reviews-Sinclairs_Retreat_Dooars_Chalsa-Jalpaiguri_Jalpaiguri_District_West_Bengal.html',
  },
  {
    quote: 'I had a wonderful experience at Sinclairs Retreat Ooty.',
    author: 'Kajal N.',
    propertyName: 'Sinclairs Retreat Ooty',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.com/Hotel_Review-g297679-d477871-Reviews-Sinclairs_Retreat_Ooty-Ooty_Udhagamandalam_The_Nilgiris_District_Tamil_Nadu.html',
  },
  {
    quote: 'Immaculate, clean and well maintained. Very courteous, polite, prompt.',
    author: 'Shalini',
    propertyName: 'Sinclairs Burdwan',
    rating: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.com/ShowUserReviews-g9456047-d9452634-r937533959-Sinclairs_Burdwan-Burdwan_Bardhaman_District_West_Bengal.html',
  },
];

// A rating for the food specifically, as a source publishes it — separate from
// the overall review scores above, which are about the stay as a whole and say
// nothing about the restaurant.
export interface FoodRating {
  propertyName: string;
  rating: number;
  outOf: number;
  source: string;
  url: string;
  // How many reviews the score is drawn from, where the source publishes it. A
  // 5.0 from three diners and a 4.3 from four hundred are not the same claim.
  reviewCount?: number;
}

// Deliberately empty. No source in this repository carries a food score — the
// Tripadvisor import brought overall ratings only, and none of the six quotes
// above is about the food. The hotel page's Dining section reads this and shows
// nothing where there is no entry, so filling it in is a content edit and needs
// no code change. Tracked in docs/CONTENT_BACKLOG.md.
//
// Never derive one from the overall rating: a stay scored 5 for its view is not
// a restaurant scored 5, and printing it next to the menu would be inventing a
// number a named source never published.
export const foodRatings: FoodRating[] = [];

export function foodRatingFor(propertyName: string): FoodRating | undefined {
  return foodRatings.find((entry) => entry.propertyName === propertyName);
}
