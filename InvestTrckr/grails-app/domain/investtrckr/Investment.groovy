package investtrckr

class Investment {
	String name
	String tracker

	static hasMany = [purchases: Purchase, sales: Sale]
	
    static constraints = {
		name blank: false
		tracker blank: false
    }
}
