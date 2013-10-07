package investtrckr

import java.util.Date;

class Sale {
	Date date
	BigDecimal price
	Integer quantity
	
	static belongsTo = [investment:Investment]

	static constraints = {
		date blank: false
		price blank: false
		quantity blank: false
	}
}
