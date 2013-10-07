package investtrckr



import org.junit.*
import grails.test.mixin.*

@TestFor(InvestmentController)
@Mock(Investment)
class InvestmentControllerTests {

    def populateValidParams(params) {
        assert params != null
        // TODO: Populate valid properties like...
        //params["name"] = 'someValidName'
    }

    void testIndex() {
        controller.index()
        assert "/investment/list" == response.redirectedUrl
    }

    void testList() {

        def model = controller.list()

        assert model.investmentInstanceList.size() == 0
        assert model.investmentInstanceTotal == 0
    }

    void testCreate() {
        def model = controller.create()

        assert model.investmentInstance != null
    }

    void testSave() {
        controller.save()

        assert model.investmentInstance != null
        assert view == '/investment/create'

        response.reset()

        populateValidParams(params)
        controller.save()

        assert response.redirectedUrl == '/investment/show/1'
        assert controller.flash.message != null
        assert Investment.count() == 1
    }

    void testShow() {
        controller.show()

        assert flash.message != null
        assert response.redirectedUrl == '/investment/list'

        populateValidParams(params)
        def investment = new Investment(params)

        assert investment.save() != null

        params.id = investment.id

        def model = controller.show()

        assert model.investmentInstance == investment
    }

    void testEdit() {
        controller.edit()

        assert flash.message != null
        assert response.redirectedUrl == '/investment/list'

        populateValidParams(params)
        def investment = new Investment(params)

        assert investment.save() != null

        params.id = investment.id

        def model = controller.edit()

        assert model.investmentInstance == investment
    }

    void testUpdate() {
        controller.update()

        assert flash.message != null
        assert response.redirectedUrl == '/investment/list'

        response.reset()

        populateValidParams(params)
        def investment = new Investment(params)

        assert investment.save() != null

        // test invalid parameters in update
        params.id = investment.id
        //TODO: add invalid values to params object

        controller.update()

        assert view == "/investment/edit"
        assert model.investmentInstance != null

        investment.clearErrors()

        populateValidParams(params)
        controller.update()

        assert response.redirectedUrl == "/investment/show/$investment.id"
        assert flash.message != null

        //test outdated version number
        response.reset()
        investment.clearErrors()

        populateValidParams(params)
        params.id = investment.id
        params.version = -1
        controller.update()

        assert view == "/investment/edit"
        assert model.investmentInstance != null
        assert model.investmentInstance.errors.getFieldError('version')
        assert flash.message != null
    }

    void testDelete() {
        controller.delete()
        assert flash.message != null
        assert response.redirectedUrl == '/investment/list'

        response.reset()

        populateValidParams(params)
        def investment = new Investment(params)

        assert investment.save() != null
        assert Investment.count() == 1

        params.id = investment.id

        controller.delete()

        assert Investment.count() == 0
        assert Investment.get(investment.id) == null
        assert response.redirectedUrl == '/investment/list'
    }
}
