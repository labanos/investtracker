package investtrckr

class Purchase {
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
