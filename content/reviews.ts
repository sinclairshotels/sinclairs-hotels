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
